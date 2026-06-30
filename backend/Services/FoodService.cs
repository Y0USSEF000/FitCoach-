using System.Text.Json;
using FitWolf.Api.Models;

namespace FitWolf.Api.Services;

/// <summary>
/// Looks up packaged products by barcode using the free Open Food Facts API
/// (no API key needed). Returns nutrition scaled to the requested grams
/// (defaults to 100g when no quantity is given).
/// </summary>
public class FoodService
{
    private readonly HttpClient _http;
    private readonly ILogger<FoodService> _log;

    public FoodService(HttpClient http, ILogger<FoodService> log)
    {
        _http = http;
        _log = log;
        // Open Food Facts asks every caller to identify itself.
        if (_http.DefaultRequestHeaders.UserAgent.Count == 0)
            _http.DefaultRequestHeaders.UserAgent.ParseAdd("FitWolf/1.0 (nutrition app)");
    }

    public async Task<FoodAnalysisResult?> LookupBarcodeAsync(string barcode, double grams)
    {
        barcode = new string((barcode ?? "").Where(char.IsDigit).ToArray());
        if (barcode.Length < 6) return null;

        var url = $"https://world.openfoodfacts.org/api/v2/product/{barcode}.json" +
                  "?fields=product_name,brands,nutriments,serving_size,quantity";

        JsonDocument doc;
        try
        {
            var resp = await _http.GetAsync(url);
            if (!resp.IsSuccessStatusCode) { _log.LogWarning("OFF {Code} -> {Status}", barcode, resp.StatusCode); return null; }
            doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        }
        catch (Exception e) { _log.LogWarning(e, "OFF lookup failed for {Code}", barcode); return null; }

        using (doc)
        {
            var root = doc.RootElement;
            if (!root.TryGetProperty("status", out var st) || st.GetInt32() != 1) return null;
            if (!root.TryGetProperty("product", out var p)) return null;

            var nutr = p.TryGetProperty("nutriments", out var n) && n.ValueKind == JsonValueKind.Object ? n : default;
            double Per100(string key) =>
                nutr.ValueKind == JsonValueKind.Object && nutr.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.Number
                    ? v.GetDouble() : 0;

            double useGrams = grams > 0 ? grams : 100;
            double factor = useGrams / 100.0;

            var pname = p.TryGetProperty("product_name", out var pn) ? pn.GetString() ?? "" : "";
            var brands = p.TryGetProperty("brands", out var br) ? br.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(pname)) pname = "Scanned product";

            double kcal100 = Per100("energy-kcal_100g");
            if (kcal100 == 0) { var kj = Per100("energy_100g"); if (kj > 0) kcal100 = kj / 4.184; }

            return new FoodAnalysisResult
            {
                FoodName = string.IsNullOrWhiteSpace(brands) ? pname : $"{pname} ({brands})",
                EstimatedGrams = (int)Math.Round(useGrams),
                Calories = Math.Round(kcal100 * factor),
                Protein = Math.Round(Per100("proteins_100g") * factor, 1),
                Carbs = Math.Round(Per100("carbohydrates_100g") * factor, 1),
                Fat = Math.Round(Per100("fat_100g") * factor, 1),
                Fiber = Math.Round(Per100("fiber_100g") * factor, 1),
                Sugar = Math.Round(Per100("sugars_100g") * factor, 1),
                Sodium = Math.Round(Per100("sodium_100g") * 1000 * factor), // OFF gives sodium in grams → mg
                Confidence = kcal100 > 0 ? "high" : "low",
                CoachMessage = "",
                IngredientsDetected = $"Barcode {barcode} · " + (grams > 0 ? $"{useGrams:0}g" : "per 100g"),
            };
        }
    }
}
