using YsfCoach.Api.Models;

namespace YsfCoach.Api.Services;

/// <summary>Ports calculate_targets / calculate_bmi from the original bot.</summary>
public static class NutritionService
{
    private static readonly string[] MaleWords = { "ذكر", "Homme", "Männlich", "Hombre" };

    private static readonly Dictionary<string, double> ActivityMult = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sedentary"] = 1.2, ["sitzend"] = 1.2, ["خامل"] = 1.2, ["sédentaire"] = 1.2, ["sedentario"] = 1.2,
        ["light"] = 1.375, ["léger"] = 1.375, ["leicht"] = 1.375, ["ligero"] = 1.375, ["خفيف"] = 1.375,
        ["moderate"] = 1.55, ["modéré"] = 1.55, ["mäßig"] = 1.55, ["moderado"] = 1.55, ["معتدل"] = 1.55,
        ["active"] = 1.725, ["actif"] = 1.725, ["aktiv"] = 1.725, ["activo"] = 1.725, ["نشيط"] = 1.725,
        ["very active"] = 1.9, ["très actif"] = 1.9, ["sehr aktiv"] = 1.9, ["muy activo"] = 1.9, ["نشيط جداً"] = 1.9,
    };

    public static Targets CalculateTargets(double height, double weight, int age, string gender, string activity, string goal)
    {
        bool isMale = gender.ToLower().Contains("male") || MaleWords.Contains(gender);
        double bmr = 10 * weight + 6.25 * height - 5 * age + (isMale ? 5 : -161);

        double mult = ActivityMult.TryGetValue(activity, out var m) ? m : 1.55;
        double tdee = bmr * mult;

        string gl = goal.ToLower();
        double calories, protein;
        if (ContainsAny(gl, "lose", "fat", "gras", "fett", "grasa", "إنقاص", "نقص"))
        {
            calories = tdee - 400; protein = weight * 2.2;
        }
        else if (ContainsAny(gl, "gain", "muscle", "muskel", "músculo", "بناء"))
        {
            calories = tdee + 300; protein = weight * 2.4;
        }
        else
        {
            calories = tdee; protein = weight * 2.0;
        }

        double fat = calories * 0.25 / 9;
        double carbs = Math.Max((calories - protein * 4 - fat * 9) / 4, 0);

        return new Targets
        {
            Calories = (int)Math.Round(calories),
            Protein = (int)Math.Round(protein),
            Carbs = (int)Math.Round(carbs),
            Fat = (int)Math.Round(fat),
        };
    }

    public static (double Bmi, string Category) CalculateBmi(double weight, double height)
    {
        double bmi = weight / Math.Pow(height / 100.0, 2);
        string cat = bmi < 18.5 ? "Underweight"
                   : bmi < 25 ? "Normal weight"
                   : bmi < 30 ? "Overweight" : "Obese";
        return (Math.Round(bmi, 1), cat);
    }

    private static bool ContainsAny(string s, params string[] words) => words.Any(s.Contains);
}
