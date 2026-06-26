using System.Text.Json;
using Microsoft.Data.Sqlite;
using YsfCoach.Api.Models;

namespace YsfCoach.Api.Services;

/// <summary>
/// SQLite-backed account store (fitwolf.db). One row per user:
///   Email (PK)  |  Token (indexed)  |  Json (full User object)
/// Keeps the same API as before, so the rest of the app is unchanged.
/// </summary>
public class UserStore
{
    private readonly string _connString;
    private readonly object _lock = new();
    private static readonly JsonSerializerOptions Json = new();

    public UserStore()
    {
        var dbPath = Path.Combine(Directory.GetCurrentDirectory(), "fitwolf.db");
        _connString = $"Data Source={dbPath}";
        Init();
        ImportLegacyJsonIfEmpty();
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connString);
        c.Open();
        return c;
    }

    private void Init()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText =
            @"CREATE TABLE IF NOT EXISTS Users (
                Email TEXT PRIMARY KEY,
                Token TEXT,
                Json  TEXT NOT NULL
              );
              CREATE INDEX IF NOT EXISTS idx_users_token ON Users(Token);";
        cmd.ExecuteNonQuery();
    }

    private static string Key(string email) => (email ?? "").Trim().ToLowerInvariant();

    private User? Read(SqliteDataReader r)
    {
        var json = r.GetString(0);
        return JsonSerializer.Deserialize<User>(json, Json);
    }

    // ─── Reads ──────────────────────────────────────────
    public User? Get(string email)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT Json FROM Users WHERE Email = $e";
        cmd.Parameters.AddWithValue("$e", Key(email));
        using var r = cmd.ExecuteReader();
        return r.Read() ? Read(r) : null;
    }

    public User? GetByToken(string? token)
    {
        if (string.IsNullOrEmpty(token)) return null;
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT Json FROM Users WHERE Token = $t";
        cmd.Parameters.AddWithValue("$t", token);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Read(r) : null;
    }

    /// <summary>True if an account with this email already exists (any state).</summary>
    public bool Exists(string email)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT 1 FROM Users WHERE Email = $e LIMIT 1";
        cmd.Parameters.AddWithValue("$e", Key(email));
        return cmd.ExecuteScalar() != null;
    }

    // ─── Writes ─────────────────────────────────────────
    public void Set(string email, User user)
    {
        lock (_lock)
        {
            user.Email = Key(email);
            using var c = Open();
            using var cmd = c.CreateCommand();
            cmd.CommandText =
                @"INSERT INTO Users (Email, Token, Json) VALUES ($e, $t, $j)
                  ON CONFLICT(Email) DO UPDATE SET Token = $t, Json = $j;";
            cmd.Parameters.AddWithValue("$e", user.Email);
            cmd.Parameters.AddWithValue("$t", (object?)user.Token ?? DBNull.Value);
            cmd.Parameters.AddWithValue("$j", JsonSerializer.Serialize(user, Json));
            cmd.ExecuteNonQuery();
        }
    }

    public void Delete(string email)
    {
        lock (_lock)
        {
            using var c = Open();
            using var cmd = c.CreateCommand();
            cmd.CommandText = "DELETE FROM Users WHERE Email = $e";
            cmd.Parameters.AddWithValue("$e", Key(email));
            cmd.ExecuteNonQuery();
        }
    }

    // ─── Meal helpers ───────────────────────────────────
    public void AddMeal(string email, Meal meal)
    {
        lock (_lock)
        {
            var u = Get(email);
            if (u is null) return;
            var t = Today();
            if (!u.Days.TryGetValue(t, out var day)) { day = new DayLog(); u.Days[t] = day; }
            day.Protein = Math.Round(day.Protein + meal.Protein, 1);
            day.Carbs = Math.Round(day.Carbs + meal.Carbs, 1);
            day.Fat = Math.Round(day.Fat + meal.Fat, 1);
            day.Calories = Math.Round(day.Calories + meal.Calories, 1);
            day.Meals.Add(meal);
            Set(email, u);
        }
    }

    public Meal? RemoveLastMeal(string email)
    {
        lock (_lock)
        {
            var u = Get(email);
            if (u is null || !u.Days.TryGetValue(Today(), out var day) || day.Meals.Count == 0) return null;
            var meal = day.Meals[^1];
            day.Meals.RemoveAt(day.Meals.Count - 1);
            day.Protein = Math.Max(Math.Round(day.Protein - meal.Protein, 1), 0);
            day.Carbs = Math.Max(Math.Round(day.Carbs - meal.Carbs, 1), 0);
            day.Fat = Math.Max(Math.Round(day.Fat - meal.Fat, 1), 0);
            day.Calories = Math.Max(Math.Round(day.Calories - meal.Calories, 1), 0);
            Set(email, u);
            return meal;
        }
    }

    // ─── One-time import from the old accounts.json ─────
    private void ImportLegacyJsonIfEmpty()
    {
        try
        {
            using (var c = Open())
            using (var cmd = c.CreateCommand())
            {
                cmd.CommandText = "SELECT COUNT(*) FROM Users";
                if (Convert.ToInt64(cmd.ExecuteScalar()) > 0) return; // already has data
            }
            var legacy = Path.Combine(Directory.GetCurrentDirectory(), "accounts.json");
            if (!File.Exists(legacy)) return;
            var data = JsonSerializer.Deserialize<Dictionary<string, User>>(File.ReadAllText(legacy));
            if (data is null) return;
            foreach (var (k, u) in data) Set(string.IsNullOrEmpty(u.Email) ? k : u.Email, u);
            File.Move(legacy, legacy + ".imported", overwrite: true);
        }
        catch { /* best effort */ }
    }

    // ─── Static helpers (unchanged) ─────────────────────
    public static string Today() => DateTime.Now.ToString("yyyy-MM-dd");
    public static string NowTime() => DateTime.Now.ToString("HH:mm");

    public static DayLog TodayLog(User u) =>
        u.Days.TryGetValue(Today(), out var day) ? day : new DayLog();
}
