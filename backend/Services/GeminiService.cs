using System.Text;
using System.Text.Json;
using FitWolf.Api.Models;

namespace FitWolf.Api.Services;

/// <summary>
/// Ports the Gemini text + vision calls. Uses the public generativelanguage REST API
/// with model fallback, matching the Python GEMINI_MODELS list.
/// </summary>
public class GeminiService
{
    private static readonly string[] Models =
    {
        "gemini-2.5-flash",       // try first
        "gemini-2.0-flash",       // separate quota
        "gemini-2.0-flash-lite",  // lite — own quota
        "gemini-2.5-flash-lite",  // lite — own quota
        "gemini-3-flash-preview", // gemini-3 — fresh quota
        "gemini-3.1-flash-lite",  // 3.1 lite — fresh quota
        "gemini-3.5-flash",       // 3.5 — fresh quota
        "gemini-flash-latest",    // alias — fallback
    };

    private static readonly Dictionary<string, string> LangNames = new()
    {
        ["en"] = "English", ["ar"] = "Arabic", ["fr"] = "French",
        ["de"] = "German", ["es"] = "Spanish",
    };

    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly ILogger<GeminiService> _log;

    public GeminiService(HttpClient http, IConfiguration cfg, ILogger<GeminiService> log)
    {
        _http = http;
        _apiKey = cfg["GEMINI_API_KEY"] ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY") ?? "";
        _log = log;
    }

    private static string LangName(string lang) => LangNames.GetValueOrDefault(lang, "English");

    // ─── Low-level calls ────────────────────────────────
    private string _lastGeminiError = "";

    private async Task<string> GenerateAsync(object[] parts)
    {
        var errors = new List<string>();
        foreach (var model in Models)
        {
            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";
                var body = new { contents = new[] { new { parts } } };
                var resp = await _http.PostAsync(url,
                    new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));
                var rawBody = await resp.Content.ReadAsStringAsync();

                if ((int)resp.StatusCode == 429)
                {
                    // Quota exceeded for this model — skip immediately to next model
                    errors.Add($"{model}:QUOTA_EXCEEDED");
                    _log.LogWarning("{Model} quota exceeded, trying next model", model);
                    continue;
                }
                if (!resp.IsSuccessStatusCode)
                {
                    errors.Add($"{model}:{(int)resp.StatusCode}");
                    _log.LogWarning("{Model} failed: {Status} — {Body}", model, resp.StatusCode, rawBody);
                    continue;
                }
                using var doc = JsonDocument.Parse(rawBody);
                var text = doc.RootElement
                    .GetProperty("candidates")[0]
                    .GetProperty("content")
                    .GetProperty("parts")[0]
                    .GetProperty("text").GetString();
                _log.LogInformation("{Model} succeeded", model);
                return (text ?? "").Trim();
            }
            catch (Exception e)
            {
                errors.Add($"{model}:exception:{e.Message}");
                _log.LogWarning(e, "{Model} threw", model);
            }
        }
        _lastGeminiError = string.Join(" | ", errors);
        return "";
    }

    private Task<string> TextAsync(string prompt) =>
        GenerateAsync(new object[] { new { text = prompt } });

    private static string DetectMimeType(byte[] data)
    {
        if (data.Length >= 4 && data[0] == 0x89 && data[1] == 0x50) return "image/png";
        if (data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8) return "image/jpeg";
        if (data.Length >= 4 && data[0] == 0x47 && data[1] == 0x49) return "image/gif";
        return "image/jpeg"; // default fallback
    }

    private Task<string> VisionAsync(byte[] image, string prompt) =>
        GenerateAsync(new object[]
        {
            new { inline_data = new { mime_type = DetectMimeType(image), data = Convert.ToBase64String(image) } },
            new { text = prompt },
        });

    // ─── Key test ───────────────────────────────────────
    public async Task<(bool Ok, string Detail)> TestAsync()
    {
        var results = new List<string>();
        foreach (var model in Models)
        {
            try
            {
                var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_apiKey}";
                var body = new { contents = new[] { new { parts = new object[] { new { text = "Say hello in one word." } } } } };
                var resp = await _http.PostAsync(url,
                    new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));
                var rawBody = await resp.Content.ReadAsStringAsync();
                if ((int)resp.StatusCode == 429)
                {
                    results.Add($"{model}: QUOTA_EXCEEDED (429)");
                    continue;
                }
                if (!resp.IsSuccessStatusCode)
                {
                    results.Add($"{model}: ERROR {(int)resp.StatusCode}");
                    continue;
                }
                using var doc = JsonDocument.Parse(rawBody);
                var text = doc.RootElement
                    .GetProperty("candidates")[0].GetProperty("content")
                    .GetProperty("parts")[0].GetProperty("text").GetString();
                return (true, $"{model} OK — replied: {text}. Others tried: {string.Join(", ", results)}");
            }
            catch (Exception e)
            {
                results.Add($"{model}: exception:{e.Message}");
            }
        }
        return (false, $"All models failed: {string.Join(" | ", results)}");
    }

    // ─── Meal plan ──────────────────────────────────────
    public async Task<string> GenerateMealPlanAsync(User u, string lang)
    {
        var t = u.Targets!;
        var prompt =
            $"You are FitWolf, a nutritionist. Write in {LangName(lang)} only.\n" +
            "Create a 1-day sample meal plan for:\n" +
            $"Goal: {u.Goal} | {t.Calories} kcal | Protein: {t.Protein}g | Carbs: {t.Carbs}g | Fat: {t.Fat}g\n\n" +
            $"Use this format (translate to {LangName(lang)}):\n" +
            "🌅 Breakfast: [meal] — ~X kcal, Xg protein\n" +
            "☀️ Lunch: [meal] — ~X kcal, Xg protein\n" +
            "🌙 Dinner: [meal] — ~X kcal, Xg protein\n" +
            "🍎 Snack: [meal] — ~X kcal\n\n" +
            "Then add 3 short practical tips for the goal. Max 300 words. Plain text only.";

        var result = await TextAsync(prompt);
        return string.IsNullOrWhiteSpace(result) ? FallbackPlan(u, lang) : result;
    }

    public async Task<string> CoachMessageAsync(User u, string lang)
    {
        var t = u.Targets!;
        var prompt =
            $"You are FitWolf, a professional nutrition coach. Respond in {LangName(lang)}.\n" +
            $"Client: {u.Age}yo, {u.Height}cm, {u.Weight}kg, activity: {u.Activity}, goal: {u.Goal}.\n" +
            $"Targets: {t.Calories} kcal, {t.Protein}g protein, {t.Carbs}g carbs, {t.Fat}g fat.\n" +
            $"Write exactly 2 sentences in {LangName(lang)}: why these targets fit the goal, " +
            "then one specific actionable tip. Plain text only.";
        var result = await TextAsync(prompt);
        return string.IsNullOrWhiteSpace(result) ? "" : result;
    }

    // ─── Food photo analysis ────────────────────────────
    public async Task<FoodAnalysisResult> AnalyzeFoodAsync(byte[] image, Targets targets, DayLog eaten, string lang)
    {
        var rem = new
        {
            calories = targets.Calories - eaten.Calories,
            protein = targets.Protein - eaten.Protein,
            carbs = targets.Carbs - eaten.Carbs,
            fat = targets.Fat - eaten.Fat,
        };
        var name = LangName(lang);
        var prompt =
            $"You are an expert dietitian and food-vision AI trained on USDA FoodData Central and food photography. Respond ONLY in {name}.\n\n" +
            "Analyze this photo and estimate its nutrition AS ACCURATELY AS POSSIBLE. Think step by step internally before answering:\n\n" +
            "STEP 1 — Identify every distinct component on the plate/in the glass separately (e.g. 'rice', 'grilled chicken', 'olive oil', 'ketchup', 'bun', 'cheese'). Don't lump everything into one item.\n" +
            "STEP 2 — Estimate the WEIGHT in grams of EACH component using visual size cues: a standard dinner plate is ~26cm, a fork ~19cm, a tablespoon ~15g, a closed fist ~150g, a deck-of-cards of meat ~85g, a slice of bread ~30g, a cup ~240ml.\n" +
            "STEP 3 — For EACH component, use realistic per-100g values from standard nutrition databases. CRUCIAL: account for the cooking method and hidden ingredients — fried foods absorb oil (add ~8-12g fat per portion), sauces/dressings/butter/sugar add real calories, grilled/boiled add little. Don't underestimate restaurant or fast food.\n" +
            "STEP 4 — SUM all components to get the TOTAL calories, protein, carbs, fat, fiber, sugar, sodium for the whole photo. estimated_grams = total weight of all food.\n\n" +
            "Reference values for common drinks: Black coffee ~5 kcal; Espresso 30ml ~3 kcal; Latte 250ml ~120 kcal/6P/10C/6F; Cappuccino 200ml ~80 kcal/4P/6C/4F; Orange juice 250ml ~110 kcal/2P/26C; Whole milk 250ml ~150 kcal/8P/12C/8F; Green tea ~2 kcal; Cola 330ml ~140 kcal/35C sugar.\n\n" +
            $"User daily targets: {targets.Calories} kcal | {targets.Protein}g protein | {targets.Carbs}g carbs | {targets.Fat}g fat\n" +
            $"Already eaten today: {eaten.Calories} kcal | {eaten.Protein}g protein | {eaten.Carbs}g carbs | {eaten.Fat}g fat\n" +
            $"Still remaining: {rem.calories} kcal | {rem.protein}g protein | {rem.carbs}g carbs | {rem.fat}g fat\n\n" +
            "RULES:\n" +
            "1. ALWAYS return ONE valid JSON object — never refuse, never write anything outside the JSON.\n" +
            "2. If the image is unclear, still give your best numeric estimate and set confidence to 'low'.\n" +
            "3. 'ingredients_detected' MUST be a per-item breakdown listing each component with its grams and kcal, e.g. 'Grilled chicken (120g, 200 kcal); White rice (150g, 195 kcal); Olive oil (10g, 88 kcal)'.\n" +
            "4. 'coach_message' = one short sentence comparing this meal to the user's remaining targets.\n" +
            "5. Write food_name, coach_message, and ingredients_detected in " + name + ". Numbers must be plain numbers (no units inside JSON values).\n\n" +
            "Return EXACTLY this JSON structure (raw, no markdown fences):\n" +
            "{\"food_name\":\"Chicken & rice plate\",\"estimated_grams\":280,\"calories\":483,\"protein\":42," +
            "\"carbs\":45,\"fat\":15,\"fiber\":2,\"sugar\":1,\"sodium\":380," +
            "\"confidence\":\"high\",\"coach_message\":\"High-protein and fits your remaining calories well.\"," +
            "\"ingredients_detected\":\"Grilled chicken (120g, 200 kcal); White rice (150g, 195 kcal); Olive oil (10g, 88 kcal)\"}";

        var raw = (await VisionAsync(image, prompt)).Trim();
        if (string.IsNullOrEmpty(raw)) throw new InvalidOperationException($"Gemini failed. Last error: {_lastGeminiError}");

        raw = ExtractJson(raw);

        try
        {
            var result = JsonSerializer.Deserialize<FoodAnalysisResult>(raw);
            if (result != null) return result;
        }
        catch (JsonException ex)
        {
            _log.LogWarning(ex, "JSON parse failed, raw: {Raw}", raw);
        }

        // Fallback: try lenient parse by extracting key fields
        return ParseFallback(raw, name);
    }

    // ─── Food name search (typed food → nutrition) ──────
    public async Task<FoodAnalysisResult> SearchFoodByNameAsync(string query, double grams, string lang)
    {
        var name = LangName(lang);
        var portion = grams > 0
            ? $"for exactly {grams} grams of it"
            : "for ONE typical serving (and set estimated_grams to that serving's weight)";
        var prompt =
            $"You are an expert dietitian using USDA FoodData Central. Respond ONLY in {name}.\n" +
            $"Give the nutrition {portion} of this food: \"{query}\".\n" +
            "Use realistic values and account for the usual way it is prepared (oil, sauces, sugar).\n" +
            "Numbers must be plain numbers, no units. ALWAYS return ONE valid JSON object only, no markdown.\n" +
            "Write food_name and coach_message in " + name + ".\n" +
            "Return EXACTLY this JSON:\n" +
            "{\"food_name\":\"Margherita pizza slice\",\"estimated_grams\":120,\"calories\":285,\"protein\":12," +
            "\"carbs\":36,\"fat\":10,\"fiber\":2,\"sugar\":4,\"sodium\":640," +
            "\"confidence\":\"high\",\"coach_message\":\"Tasty but carb-heavy — pair it with protein.\"," +
            "\"ingredients_detected\":\"Dough, tomato sauce, mozzarella\"}";

        var raw = (await TextAsync(prompt)).Trim();
        if (string.IsNullOrEmpty(raw)) throw new InvalidOperationException($"Gemini failed. Last error: {_lastGeminiError}");
        raw = ExtractJson(raw);
        try
        {
            var result = JsonSerializer.Deserialize<FoodAnalysisResult>(raw);
            if (result != null) return result;
        }
        catch (JsonException ex) { _log.LogWarning(ex, "Search JSON parse failed, raw: {Raw}", raw); }
        return ParseFallback(raw, name);
    }

    // ─── Food name search → MULTIPLE options to choose from ──
    public async Task<List<FoodAnalysisResult>> SearchFoodOptionsAsync(string query, string lang)
    {
        var name = LangName(lang);
        var prompt =
            $"You are an expert dietitian using USDA FoodData Central. Respond ONLY in {name}.\n" +
            $"The user searched for the food: \"{query}\".\n" +
            "Return a JSON ARRAY of 5 to 8 of the most common real variants or types of this food " +
            "(different proteins like chicken/beef/mix, different styles, sizes, sandwich vs plate, or closely related dishes the user might mean). " +
            "Each entry is ONE typical serving with realistic nutrition — account for oil, bread, sauces and how it is usually prepared.\n" +
            "Set estimated_grams to that serving's weight. Numbers must be plain numbers, no units.\n" +
            "Write food_name in " + name + ". Return ONLY the JSON array (no markdown), like:\n" +
            "[{\"food_name\":\"Chicken shawarma sandwich\",\"estimated_grams\":250,\"calories\":480,\"protein\":28,\"carbs\":45,\"fat\":20,\"fiber\":3,\"sugar\":4,\"sodium\":900,\"confidence\":\"high\",\"coach_message\":\"\",\"ingredients_detected\":\"Chicken, bread, garlic sauce\"}," +
            "{\"food_name\":\"Beef shawarma plate\",\"estimated_grams\":350,\"calories\":650,\"protein\":35,\"carbs\":50,\"fat\":32,\"fiber\":4,\"sugar\":5,\"sodium\":1100,\"confidence\":\"high\",\"coach_message\":\"\",\"ingredients_detected\":\"Beef, rice, salad\"}]";

        var raw = (await TextAsync(prompt)).Trim();
        if (string.IsNullOrEmpty(raw)) throw new InvalidOperationException($"Gemini failed. Last error: {_lastGeminiError}");
        raw = ExtractJsonArray(raw);
        try
        {
            var list = JsonSerializer.Deserialize<List<FoodAnalysisResult>>(raw);
            if (list != null && list.Count > 0) return list;
        }
        catch (JsonException ex) { _log.LogWarning(ex, "Search options JSON parse failed, raw: {Raw}", raw); }
        // Fallback: at least return the single best estimate.
        return new List<FoodAnalysisResult> { await SearchFoodByNameAsync(query, 0, lang) };
    }

    private static string ExtractJsonArray(string raw)
    {
        if (raw.Contains("```"))
        {
            foreach (var block in raw.Split("```"))
            {
                var trimmed = block.TrimStart().TrimStart("json\n".ToCharArray()).Trim();
                if (trimmed.StartsWith("[")) { raw = trimmed; break; }
            }
        }
        int start = raw.IndexOf('[');
        if (start == -1) return raw;
        int depth = 0, end = -1;
        for (int i = start; i < raw.Length; i++)
        {
            if (raw[i] == '[') depth++;
            else if (raw[i] == ']') { depth--; if (depth == 0) { end = i; break; } }
        }
        return (end > start) ? raw.Substring(start, end - start + 1) : raw;
    }

    private static string ExtractJson(string raw)
    {
        // Remove markdown code fences
        if (raw.Contains("```"))
        {
            var blocks = raw.Split("```");
            foreach (var block in blocks)
            {
                var trimmed = block.TrimStart().TrimStart("json\n".ToCharArray()).Trim();
                if (trimmed.StartsWith("{")) { raw = trimmed; break; }
            }
        }
        // Extract first complete JSON object
        int start = raw.IndexOf('{');
        if (start == -1) return raw;
        int depth = 0, end = -1;
        for (int i = start; i < raw.Length; i++)
        {
            if (raw[i] == '{') depth++;
            else if (raw[i] == '}') { depth--; if (depth == 0) { end = i; break; } }
        }
        return (end > start) ? raw.Substring(start, end - start + 1) : raw;
    }

    private static FoodAnalysisResult ParseFallback(string raw, string lang)
    {
        // Best-effort field extraction if JSON is malformed
        static double ExtNum(string src, string key)
        {
            var idx = src.IndexOf($"\"{key}\"");
            if (idx < 0) return 0;
            var after = src.Substring(idx + key.Length + 3).TrimStart(' ', ':', '"');
            var numStr = new string(after.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
            return double.TryParse(numStr, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : 0;
        }
        static string ExtStr(string src, string key)
        {
            var idx = src.IndexOf($"\"{key}\"");
            if (idx < 0) return "";
            var after = src.Substring(idx + key.Length + 3);
            var q = after.IndexOf('"');
            if (q < 0) return "";
            after = after.Substring(q + 1);
            var q2 = after.IndexOf('"');
            return q2 < 0 ? after : after.Substring(0, q2);
        }
        var foodName = ExtStr(raw, "food_name");
        var confidence = ExtStr(raw, "confidence");
        return new FoodAnalysisResult
        {
            FoodName = string.IsNullOrWhiteSpace(foodName) ? "Unknown Food" : foodName,
            EstimatedGrams = (int)ExtNum(raw, "estimated_grams"),
            Calories = ExtNum(raw, "calories"),
            Protein = ExtNum(raw, "protein"),
            Carbs = ExtNum(raw, "carbs"),
            Fat = ExtNum(raw, "fat"),
            Fiber = ExtNum(raw, "fiber"),
            Sugar = ExtNum(raw, "sugar"),
            Sodium = ExtNum(raw, "sodium"),
            Confidence = string.IsNullOrWhiteSpace(confidence) ? "low" : confidence,
            CoachMessage = ExtStr(raw, "coach_message"),
            IngredientsDetected = ExtStr(raw, "ingredients_detected"),
        };
    }

    // ─── Fallback plan (offline) ────────────────────────
    private static string FallbackPlan(User u, string lang)
    {
        var t = u.Targets!;
        int bCal = (int)Math.Round(t.Calories * 0.25), lCal = (int)Math.Round(t.Calories * 0.35),
            dCal = (int)Math.Round(t.Calories * 0.30), sCal = (int)Math.Round(t.Calories * 0.10);
        int bPro = (int)Math.Round(t.Protein * 0.25), lPro = (int)Math.Round(t.Protein * 0.35),
            dPro = (int)Math.Round(t.Protein * 0.30);
        string g = u.Goal.ToLower();
        bool gain = g.Contains("gain") || g.Contains("muscle") || g.Contains("بناء") || g.Contains("muskel") || g.Contains("músculo");
        bool lose = g.Contains("lose") || g.Contains("fat") || g.Contains("gras") || g.Contains("إنقاص") || g.Contains("fett") || g.Contains("grasa");

        // English fallback (other languages fall back to English text here for brevity).
        string b, l, d, s, tips;
        if (gain)
        {
            (b, l, d, s) = ("Oatmeal with eggs and banana", "Grilled chicken with brown rice and salad",
                            "Ground beef with pasta and tomato sauce", "Greek yogurt with mixed nuts");
            tips = "• Drink 3L water daily\n• Protein within 1h after training\n• Sleep 8h for recovery";
        }
        else if (lose)
        {
            (b, l, d, s) = ("Scrambled eggs with whole grain toast and avocado", "Grilled chicken salad with vegetables",
                            "Grilled fish with steamed vegetables", "Apple with peanut butter");
            tips = "• Reduce sugar and refined carbs\n• Protein in every meal\n• Walk 30 minutes daily";
        }
        else
        {
            (b, l, d, s) = ("Whole grain toast with eggs and cottage cheese", "Rice with chicken and vegetables",
                            "Lentil soup with whole grain bread", "Seasonal fruits");
            tips = "• Keep regular meal times\n• Vary protein sources\n• Drink water before each meal";
        }
        return
            $"🌅 Breakfast: {b}\n   ~{bCal} kcal | {bPro}g protein\n\n" +
            $"☀️ Lunch: {l}\n   ~{lCal} kcal | {lPro}g protein\n\n" +
            $"🌙 Dinner: {d}\n   ~{dCal} kcal | {dPro}g protein\n\n" +
            $"🍎 Snack: {s}\n   ~{sCal} kcal\n\n💡 Tips:\n{tips}";
    }
}
