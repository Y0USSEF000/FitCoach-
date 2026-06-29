using System.Globalization;
using System.Text.Json;
using YsfCoach.Api.Models;

namespace YsfCoach.Api.Services;

/// <summary>
/// Looks up verified nutrition from Open Food Facts (free, open database).
/// Used for text search and barcode scanning. Macros are normalized to per-100g.
/// </summary>
public class FoodService
{
    private readonly HttpClient _http;
    private readonly ILogger<FoodService> _log;

    public FoodService(HttpClient http, ILogger<FoodService> log)
    {
        _http = http;
        _log = log;
        if (!_http.DefaultRequestHeaders.Contains("User-Agent"))
            _http.DefaultRequestHeaders.Add("User-Agent", "FitWolf/1.0 (nutrition app)");
    }

    public async Task<List<FoodItem>> SearchAsync(string query)
    {
        var results = new List<FoodItem>();
        try
        {
            // Search-a-licious — OFF's fast search service (the legacy cgi/search.pl took 30s+).
            var url = $"https://search.openfoodfacts.org/search?q={Uri.EscapeDataString(query)}" +
                      "&page_size=30&fields=code,product_name,brands,nutriments,serving_quantity";
            using var doc = JsonDocument.Parse(await _http.GetStringAsync(url));
            if (doc.RootElement.TryGetProperty("hits", out var hits))
                foreach (var p in hits.EnumerateArray())
                {
                    var item = Parse(p);
                    if (item != null && item.Calories > 0) results.Add(item);
                }
        }
        catch (Exception e) { _log.LogWarning(e, "OFF search failed for {Query}", query); }
        return results;
    }

    public async Task<FoodItem?> BarcodeAsync(string code)
    {
        try
        {
            var url = $"https://world.openfoodfacts.org/api/v2/product/{Uri.EscapeDataString(code)}.json" +
                      "?fields=code,product_name,brands,nutriments,serving_quantity";
            using var doc = JsonDocument.Parse(await _http.GetStringAsync(url));
            if (doc.RootElement.TryGetProperty("product", out var product))
                return Parse(product);
        }
        catch (Exception e) { _log.LogWarning(e, "OFF barcode failed for {Code}", code); }
        return null;
    }

    private static FoodItem? Parse(JsonElement p)
    {
        var name = Str(p, "product_name");
        if (string.IsNullOrWhiteSpace(name)) return null;
        var n = p.TryGetProperty("nutriments", out var nut) ? nut : default;

        double kcal = Num(n, "energy-kcal_100g");
        if (kcal <= 0) { var kj = Num(n, "energy_100g"); if (kj > 0) kcal = Math.Round(kj / 4.184); }

        return new FoodItem
        {
            Name = name,
            Brand = Str(p, "brands"),
            Barcode = Str(p, "code"),
            Calories = kcal,
            Protein = Num(n, "proteins_100g"),
            Carbs = Num(n, "carbohydrates_100g"),
            Fat = Num(n, "fat_100g"),
            ServingGrams = Num(p, "serving_quantity") is var sg && sg > 0 ? sg : null,
        };
    }

    private static string Str(JsonElement e, string prop) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(prop, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString() ?? "" : "";

    // OFF nutriment values can be numbers or strings — handle both.
    private static double Num(JsonElement e, string prop)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(prop, out var v)) return 0;
        if (v.ValueKind == JsonValueKind.Number) return v.GetDouble();
        if (v.ValueKind == JsonValueKind.String && double.TryParse(v.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var d)) return d;
        return 0;
    }
}
