using System.Text.Json;
using FitWolf.Api.Models;

namespace FitWolf.Api.Services;

/// <summary>File-backed account store, keyed by lowercased email.</summary>
public class UserStore
{
    private readonly string _path = Path.Combine(AppContext.BaseDirectory, "accounts.json");
    private readonly object _lock = new();
    private static readonly JsonSerializerOptions Opts = new() { WriteIndented = true };

    private static string Key(string email) => (email ?? "").Trim().ToLowerInvariant();

    private Dictionary<string, User> Load()
    {
        if (!File.Exists(_path)) return new();
        try { return JsonSerializer.Deserialize<Dictionary<string, User>>(File.ReadAllText(_path)) ?? new(); }
        catch { return new(); }
    }

    private void Save(Dictionary<string, User> data)
    {
        lock (_lock) File.WriteAllText(_path, JsonSerializer.Serialize(data, Opts));
    }

    public User? Get(string email) => Load().GetValueOrDefault(Key(email));

    public User? GetByToken(string? token)
    {
        if (string.IsNullOrEmpty(token)) return null;
        return Load().Values.FirstOrDefault(u => u.Token == token);
    }

    public void Set(string email, User user)
    {
        lock (_lock)
        {
            var data = Load();
            data[Key(email)] = user;
            Save(data);
        }
    }

    public void Delete(string email)
    {
        lock (_lock)
        {
            var data = Load();
            data.Remove(Key(email));
            Save(data);
        }
    }

    public static string Today() => DateTime.Now.ToString("yyyy-MM-dd");
    public static string NowTime() => DateTime.Now.ToString("HH:mm");

    public static DayLog TodayLog(User u)
    {
        if (!u.Days.TryGetValue(Today(), out var day))
            day = new DayLog();
        return day;
    }

    public void AddMeal(string email, Meal meal)
    {
        lock (_lock)
        {
            var data = Load();
            if (!data.TryGetValue(Key(email), out var u)) return;
            var t = Today();
            if (!u.Days.TryGetValue(t, out var day)) { day = new DayLog(); u.Days[t] = day; }
            day.Protein = Math.Round(day.Protein + meal.Protein, 1);
            day.Carbs = Math.Round(day.Carbs + meal.Carbs, 1);
            day.Fat = Math.Round(day.Fat + meal.Fat, 1);
            day.Calories = Math.Round(day.Calories + meal.Calories, 1);
            day.Meals.Add(meal);
            Save(data);
        }
    }

    public Meal? RemoveLastMeal(string email)
    {
        lock (_lock)
        {
            var data = Load();
            if (!data.TryGetValue(Key(email), out var u)) return null;
            if (!u.Days.TryGetValue(Today(), out var day) || day.Meals.Count == 0) return null;
            var meal = day.Meals[^1];
            day.Meals.RemoveAt(day.Meals.Count - 1);
            day.Protein = Math.Max(Math.Round(day.Protein - meal.Protein, 1), 0);
            day.Carbs = Math.Max(Math.Round(day.Carbs - meal.Carbs, 1), 0);
            day.Fat = Math.Max(Math.Round(day.Fat - meal.Fat, 1), 0);
            day.Calories = Math.Max(Math.Round(day.Calories - meal.Calories, 1), 0);
            Save(data);
            return meal;
        }
    }
}
