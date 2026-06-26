using System.Text.Json.Serialization;

namespace YsfCoach.Api.Models;

public class Targets
{
    public int Calories { get; set; }
    public int Protein { get; set; }
    public int Carbs { get; set; }
    public int Fat { get; set; }
}

public class Meal
{
    public string Food { get; set; } = "";
    public double Protein { get; set; }
    public double Carbs { get; set; }
    public double Fat { get; set; }
    public double Calories { get; set; }
    public string Time { get; set; } = "";
    public int EstimatedGrams { get; set; }
}

public class DayLog
{
    public double Protein { get; set; }
    public double Carbs { get; set; }
    public double Fat { get; set; }
    public double Calories { get; set; }
    public List<Meal> Meals { get; set; } = new();
}

public class User
{
    // ── Account / auth ──
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string PasswordSalt { get; set; } = "";
    public bool Verified { get; set; }
    public string Token { get; set; } = "";

    // ── Engagement / analytics ──
    public string CreatedAt { get; set; } = "";          // ISO datetime account created
    public List<string> ActiveDates { get; set; } = new(); // distinct days the user opened the app
    public int PhotoCount { get; set; }                   // total food photos analyzed

    // ── Profile ──
    public string Lang { get; set; } = "en";
    public double Height { get; set; }
    public double Weight { get; set; }
    public int Age { get; set; }
    public string Gender { get; set; } = "";
    public string Activity { get; set; } = "";
    public string Goal { get; set; } = "";
    public Targets? Targets { get; set; }
    public bool ProfileComplete { get; set; }
    public Dictionary<string, DayLog> Days { get; set; } = new();

    // Notification preferences (HH:mm strings, empty = disabled)
    public NotificationPrefs Notifications { get; set; } = new();
}

public class NotificationPrefs
{
    public bool MealReminders { get; set; } = true;
    public bool WaterReminders { get; set; } = true;
    public bool DidYouEatToday { get; set; } = true;
    public List<string> MealTimes { get; set; } = new() { "08:00", "13:00", "19:00" };
    public int WaterIntervalHours { get; set; } = 2;
}

// ─── DTOs ───────────────────────────────────────────────
public record OnboardRequest(
    string Lang, double Height, double Weight, int Age,
    string Gender, string Activity, string Goal);

// Auth DTOs
public record AuthStartRequest(string Email);
public record AuthVerifyRequest(string Email, string Code);
public record RegisterRequest(string Email, string Name, string Password);
public record LoginRequest(string Email, string Password);

public record FoodAnalysisResult
{
    [JsonPropertyName("food_name")] public string FoodName { get; set; } = "Food";
    [JsonPropertyName("estimated_grams")] public int EstimatedGrams { get; set; }
    [JsonPropertyName("calories")] public double Calories { get; set; }
    [JsonPropertyName("protein")] public double Protein { get; set; }
    [JsonPropertyName("carbs")] public double Carbs { get; set; }
    [JsonPropertyName("fat")] public double Fat { get; set; }
    [JsonPropertyName("fiber")] public double Fiber { get; set; }
    [JsonPropertyName("sugar")] public double Sugar { get; set; }
    [JsonPropertyName("sodium")] public double Sodium { get; set; }
    [JsonPropertyName("confidence")] public string Confidence { get; set; } = "medium";
    [JsonPropertyName("coach_message")] public string CoachMessage { get; set; } = "";
    [JsonPropertyName("ingredients_detected")] public string IngredientsDetected { get; set; } = "";
}
