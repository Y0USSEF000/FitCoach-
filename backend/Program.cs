using YsfCoach.Api.Models;
using YsfCoach.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<UserStore>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddHttpClient<GeminiService>(c => c.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient<FoodService>(c => c.Timeout = TimeSpan.FromSeconds(12));
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

// Resolve the signed-in account from the X-Auth-Token header.
User? Auth(HttpRequest r, UserStore store) => store.GetByToken(r.Headers["X-Auth-Token"].FirstOrDefault());

// ═══════════════════ AUTH ═══════════════════

// 1) Enter email → send a 6-digit code. Tells the app whether the account exists.
app.MapPost("/api/auth/start", async (AuthStartRequest req, UserStore store, AuthService auth, EmailService email) =>
{
    if (!AuthService.IsValidEmail(req.Email)) return Results.BadRequest(new { error = "invalid_email" });
    var existing = store.Get(req.Email);
    bool exists = existing != null && !string.IsNullOrEmpty(existing.PasswordHash);
    var code = auth.IssueCode(req.Email);
    await email.SendCodeAsync(req.Email, code);
    // In dev (no SMTP configured) return the code so it can be shown in-app.
    return Results.Ok(new { exists, devCode = email.IsConfigured ? null : code });
});

// 1b) Check if an email already has a (registered) account — no code sent.
app.MapPost("/api/auth/check", (AuthStartRequest req, UserStore store) =>
{
    if (!AuthService.IsValidEmail(req.Email)) return Results.BadRequest(new { error = "invalid_email" });
    var u = store.Get(req.Email);
    bool exists = u != null && !string.IsNullOrEmpty(u.PasswordHash);
    return Results.Ok(new { exists });
});

// 2) Verify the code. If the account is registered → log in (return token).
//    If not → mark the email verified so the app can continue to sign-up.
app.MapPost("/api/auth/verify", (AuthVerifyRequest req, UserStore store, AuthService auth) =>
{
    if (!auth.VerifyCode(req.Email, req.Code)) return Results.BadRequest(new { error = "invalid_code" });

    var existing = store.Get(req.Email);
    bool registered = existing != null && !string.IsNullOrEmpty(existing.PasswordHash);

    if (registered)
    {
        existing!.Verified = true;
        existing.Token = auth.NewToken();
        store.Set(existing.Email, existing);
        return Results.Ok(new { registered = true, token = existing.Token, profileComplete = existing.ProfileComplete });
    }

    var u = existing ?? new User();
    u.Email = AuthService.Normalize(req.Email);
    u.Verified = true;
    store.Set(u.Email, u);
    return Results.Ok(new { registered = false, verified = true });
});

// 3) New user finishes sign-up (name + password) → returns token.
app.MapPost("/api/auth/register", (RegisterRequest req, UserStore store, AuthService auth) =>
{
    var u = store.Get(req.Email);
    if (u == null || !u.Verified) return Results.BadRequest(new { error = "email_not_verified" });
    if (!string.IsNullOrEmpty(u.PasswordHash)) return Results.Conflict(new { error = "already_registered" });
    var password = req.Password ?? "";
    if (password.Length < 6) return Results.BadRequest(new { error = "weak_password" });

    var (hash, salt) = auth.HashPassword(password);
    u.Name = (req.Name ?? "").Trim();
    u.PasswordHash = hash;
    u.PasswordSalt = salt;
    u.Token = auth.NewToken();
    u.CreatedAt = DateTime.UtcNow.ToString("o");
    var today0 = UserStore.Today();
    if (!u.ActiveDates.Contains(today0)) u.ActiveDates.Add(today0);
    store.Set(u.Email, u);
    return Results.Ok(new { token = u.Token, profileComplete = u.ProfileComplete });
});

// Optional: direct password login.
app.MapPost("/api/auth/login", (LoginRequest req, UserStore store, AuthService auth) =>
{
    var u = store.Get(req.Email);
    if (u == null || !auth.VerifyPassword(req.Password ?? "", u.PasswordHash, u.PasswordSalt))
        return Results.Json(new { error = "bad_credentials" }, statusCode: 401);
    u.Token = auth.NewToken();
    store.Set(u.Email, u);
    return Results.Ok(new { token = u.Token, profileComplete = u.ProfileComplete });
});

// ═══════════════════ PROFILE / DATA ═══════════════════

// Onboarding: compute targets + save profile onto the signed-in account.
app.MapPost("/api/onboard", (OnboardRequest req, HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);

    u.Lang = req.Lang; u.Height = req.Height; u.Weight = req.Weight; u.Age = req.Age;
    u.Gender = req.Gender; u.Activity = req.Activity; u.Goal = req.Goal;
    u.Targets = NutritionService.CalculateTargets(req.Height, req.Weight, req.Age, req.Gender, req.Activity, req.Goal);
    u.ProfileComplete = true;
    store.Set(u.Email, u);

    var (bmi, cat) = NutritionService.CalculateBmi(req.Weight, req.Height);
    return Results.Ok(new { targets = u.Targets, bmi, bmiCategory = cat, user = u });
});

app.MapGet("/api/me", (HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);

    // Track "days the user opened the app"
    var today0 = UserStore.Today();
    if (!u.ActiveDates.Contains(today0)) { u.ActiveDates.Add(today0); store.Set(u.Email, u); }

    var stats = new { daysActive = u.ActiveDates.Count, photoCount = u.PhotoCount, createdAt = u.CreatedAt };
    if (!u.ProfileComplete) return Results.Ok(new { user = u, profileComplete = false, stats });
    var (bmi, cat) = NutritionService.CalculateBmi(u.Weight, u.Height);
    return Results.Ok(new { user = u, profileComplete = true, today = UserStore.TodayLog(u), bmi, bmiCategory = cat, stats });
});

app.MapGet("/api/status", (HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    return Results.Ok(new { targets = u.Targets, today = UserStore.TodayLog(u) });
});

app.MapGet("/api/program", async (HttpRequest http, UserStore store, GeminiService gemini) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (u.Targets is null) return Results.BadRequest(new { error = "no_profile" });
    var plan = await gemini.GenerateMealPlanAsync(u, u.Lang);
    var coach = await gemini.CoachMessageAsync(u, u.Lang);
    return Results.Ok(new { plan, coach });
});

app.MapPost("/api/analyze", async (HttpRequest http, UserStore store, GeminiService gemini, FoodService food) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (u.Targets is null) return Results.BadRequest(new { error = "no_profile" });

    var form = await http.ReadFormAsync();
    var file = form.Files.GetFile("photo");
    if (file is null) return Results.BadRequest(new { error = "no_photo" });
    // save=false → preview only (user confirms/edits before logging)
    bool save = !string.Equals(form["save"].FirstOrDefault(), "false", StringComparison.OrdinalIgnoreCase);

    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);

    var eaten = UserStore.TodayLog(u);
    var r = await gemini.AnalyzeFoodAsync(ms.ToArray(), u.Targets, eaten, u.Lang);

    // ── Accuracy boost: for a single recognizable food, replace the AI's guessed
    //    numbers with VERIFIED database values (per 100g) scaled by the portion. ──
    string source = "ai";
    if (FoodMatch.IsSingleItem(r.FoodName))
    {
        try
        {
            var searchTask = food.SearchAsync(r.FoodName);
            if (await Task.WhenAny(searchTask, Task.Delay(6000)) == searchTask)
            {
                var match = searchTask.Result.FirstOrDefault(x => x.Calories > 0 && FoodMatch.IsTightMatch(r.FoodName, x.Name));
                if (match is not null)
                {
                    double g = r.EstimatedGrams > 0 ? r.EstimatedGrams : (match.ServingGrams ?? 100);
                    r.Calories = Math.Round(match.Calories * g / 100);
                    r.Protein = Math.Round(match.Protein * g / 100, 1);
                    r.Carbs = Math.Round(match.Carbs * g / 100, 1);
                    r.Fat = Math.Round(match.Fat * g / 100, 1);
                    r.EstimatedGrams = (int)Math.Round(g);
                    r.Confidence = "high";
                    source = "database";
                }
            }
        }
        catch { /* keep AI estimate */ }
    }

    // Every photo scan counts toward engagement analytics
    u.PhotoCount += 1;
    if (save)
    {
        var meal = new Meal
        {
            Food = r.FoodName, Protein = r.Protein, Carbs = r.Carbs, Fat = r.Fat,
            Calories = r.Calories, EstimatedGrams = r.EstimatedGrams, Time = UserStore.NowTime(),
        };
        // persist photo count first, then meal via AddMeal (which reloads)
        store.Set(u.Email, u);
        store.AddMeal(u.Email, meal);
    }
    else
    {
        store.Set(u.Email, u); // just the photo-count bump
    }

    return Results.Ok(new { result = r, saved = save, source });
});

// Manual / confirmed meal log (from the confirm-edit screen, food search, or barcode).
app.MapPost("/api/meals", (LogMealRequest req, HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (u.Targets is null) return Results.BadRequest(new { error = "no_profile" });

    var meal = new Meal
    {
        Food = string.IsNullOrWhiteSpace(req.Food) ? "Food" : req.Food.Trim(),
        Calories = Math.Round(req.Calories, 1), Protein = Math.Round(req.Protein, 1),
        Carbs = Math.Round(req.Carbs, 1), Fat = Math.Round(req.Fat, 1),
        EstimatedGrams = (int)Math.Round(req.Grams), Time = UserStore.NowTime(),
    };
    store.AddMeal(u.Email, meal);

    var after = UserStore.TodayLog(store.Get(u.Email)!);
    return Results.Ok(new { meal, today = after, remaining = new {
        calories = u.Targets.Calories - after.Calories,
        protein = u.Targets.Protein - after.Protein,
        carbs = u.Targets.Carbs - after.Carbs,
        fat = u.Targets.Fat - after.Fat,
    }});
});

// Recent distinct foods (for one-tap re-log of "my usual").
app.MapGet("/api/recent", (HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var recent = new List<Meal>();
    foreach (var day in u.Days.OrderByDescending(d => d.Key))
        foreach (var m in Enumerable.Reverse(day.Value.Meals))
            if (seen.Add(m.Food)) { recent.Add(m); if (recent.Count >= 15) break; }
    return Results.Ok(new { recent });
});

// Food database search (Open Food Facts).
app.MapGet("/api/foods/search", async (string q, HttpRequest http, UserStore store, FoodService food) =>
{
    if (Auth(http, store) is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (string.IsNullOrWhiteSpace(q)) return Results.Ok(new { results = new List<FoodItem>() });
    return Results.Ok(new { results = await food.SearchAsync(q) });
});

// Barcode lookup (Open Food Facts).
app.MapGet("/api/foods/barcode/{code}", async (string code, HttpRequest http, UserStore store, FoodService food) =>
{
    if (Auth(http, store) is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    var item = await food.BarcodeAsync(code);
    return item is null ? Results.NotFound(new { error = "not_found" }) : Results.Ok(new { item });
});

app.MapPost("/api/undo", (HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    var meal = store.RemoveLastMeal(u.Email);
    return Results.Ok(new { removed = meal });
});

app.MapGet("/api/notifications", (HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    return u is null ? Results.Json(new { error = "unauthorized" }, statusCode: 401) : Results.Ok(u.Notifications);
});

app.MapPut("/api/notifications", (NotificationPrefs prefs, HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    u.Notifications = prefs;
    store.Set(u.Email, u);
    return Results.Ok(prefs);
});

app.MapPut("/api/language", (LangBody body, HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    u.Lang = body.Lang;
    store.Set(u.Email, u);
    return Results.Ok(new { lang = u.Lang });
});

// Reset: wipe the whole account.
app.MapDelete("/api/me", (HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is not null) store.Delete(u.Email);
    return Results.Ok(new { reset = true });
});

app.MapGet("/", () => "FitWolf API running.");
app.Run();

record LangBody(string Lang);

// Helpers to decide when an AI-recognized food can be matched to a verified DB entry.
static class FoodMatch
{
    private static readonly string[] Stop =
        { "the", "and", "with", "of", "fresh", "raw", "cooked", "grilled", "boiled", "fried", "plain" };

    // Single recognizable item (not a composite plate) → safe to use a DB match.
    public static bool IsSingleItem(string name)
    {
        var n = (name ?? "").ToLowerInvariant();
        if (n.Contains(" and ") || n.Contains(",") || n.Contains(" with ") || n.Contains("+")) return false;
        return n.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length <= 4;
    }

    // Tight match: every meaningful AI word is in the product name, and the product
    // isn't much longer (so "banana" matches "banana" but NOT "banana yogurt drink").
    public static bool IsTightMatch(string aiName, string productName)
    {
        var ai = Words(aiName);
        var prod = Words(productName);
        if (ai.Count == 0 || prod.Count == 0) return false;
        if (!ai.All(prod.Contains)) return false;
        return prod.Count <= ai.Count + 1;
    }

    private static HashSet<string> Words(string s) =>
        (s ?? "").ToLowerInvariant()
            .Split(new[] { ' ', '-', '/', '(', ')', ',', '.' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 3 && !Stop.Contains(w))
            .ToHashSet();
}
