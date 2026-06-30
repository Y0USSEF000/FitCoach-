using FitWolf.Api.Models;
using FitWolf.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<UserStore>();
builder.Services.AddSingleton<AuthService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddHttpClient<GeminiService>(c => c.Timeout = TimeSpan.FromSeconds(60));
builder.Services.AddHttpClient<FoodService>(c => c.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

// Resolve the signed-in account from the X-Auth-Token header.
User? Auth(HttpRequest r, UserStore store) => store.GetByToken(r.Headers["X-Auth-Token"].FirstOrDefault());

// Turn a nutrition result into a logged meal and return the standard response
// (same shape as /api/analyze) so the app can reuse one handler everywhere.
object LogFood(UserStore store, User u, FitWolf.Api.Models.FoodAnalysisResult r)
{
    var meal = new Meal
    {
        Food = r.FoodName, Protein = r.Protein, Carbs = r.Carbs, Fat = r.Fat,
        Calories = r.Calories, EstimatedGrams = r.EstimatedGrams, Time = UserStore.NowTime(),
    };
    store.AddMeal(u.Email, meal);
    var after = UserStore.TodayLog(store.Get(u.Email)!);
    return new { result = r, meal, remaining = new {
        calories = u.Targets!.Calories - after.Calories,
        protein = u.Targets.Protein - after.Protein,
        carbs = u.Targets.Carbs - after.Carbs,
        fat = u.Targets.Fat - after.Fat,
    }};
}

// ═══════════════════ AUTH ═══════════════════

// 1) Enter email → send a 6-digit code. Tells the app whether the account exists.
app.MapPost("/api/auth/start", async (AuthStartRequest req, UserStore store, AuthService auth, EmailService email) =>
{
    if (!AuthService.IsValidEmail(req.Email)) return Results.BadRequest(new { error = "invalid_email" });
    var existing = store.Get(req.Email);
    bool exists = existing != null && !string.IsNullOrEmpty(existing.PasswordHash);
    var code = auth.IssueCode(req.Email);
    var sent = await email.SendCodeAsync(req.Email, code);
    // Show the code in-app if SMTP isn't configured OR the send failed
    // (e.g. Brevo account not yet activated) — so login still works.
    return Results.Ok(new { exists, devCode = sent ? null : code });
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
    if (!u.ProfileComplete) return Results.Ok(new { user = u, profileComplete = false });
    var (bmi, cat) = NutritionService.CalculateBmi(u.Weight, u.Height);
    return Results.Ok(new { user = u, profileComplete = true, today = UserStore.TodayLog(u), bmi, bmiCategory = cat });
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

app.MapPost("/api/analyze", async (HttpRequest http, UserStore store, GeminiService gemini) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (u.Targets is null) return Results.BadRequest(new { error = "no_profile" });

    var form = await http.ReadFormAsync();
    var file = form.Files.GetFile("photo");
    if (file is null) return Results.BadRequest(new { error = "no_photo" });

    using var ms = new MemoryStream();
    await file.CopyToAsync(ms);

    var eaten = UserStore.TodayLog(u);
    var r = await gemini.AnalyzeFoodAsync(ms.ToArray(), u.Targets, eaten, u.Lang);

    var meal = new Meal
    {
        Food = r.FoodName, Protein = r.Protein, Carbs = r.Carbs, Fat = r.Fat,
        Calories = r.Calories, EstimatedGrams = r.EstimatedGrams, Time = UserStore.NowTime(),
    };
    store.AddMeal(u.Email, meal);

    var after = UserStore.TodayLog(store.Get(u.Email)!);
    return Results.Ok(new { result = r, meal, remaining = new {
        calories = u.Targets.Calories - after.Calories,
        protein = u.Targets.Protein - after.Protein,
        carbs = u.Targets.Carbs - after.Carbs,
        fat = u.Targets.Fat - after.Fat,
    }});
});

// Search a food by typed name → a LIST of options to choose from (does NOT log).
app.MapPost("/api/food/search", async (FoodSearchRequest req, HttpRequest http, UserStore store, GeminiService gemini) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (u.Targets is null) return Results.BadRequest(new { error = "no_profile" });
    if (string.IsNullOrWhiteSpace(req.Query)) return Results.BadRequest(new { error = "empty_query" });
    var options = await gemini.SearchFoodOptionsAsync(req.Query.Trim(), u.Lang);
    return Results.Ok(new { options });
});

// Log a chosen food (from search options) as a meal.
app.MapPost("/api/food/log", (FitWolf.Api.Models.FoodAnalysisResult item, HttpRequest http, UserStore store) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (u.Targets is null) return Results.BadRequest(new { error = "no_profile" });
    return Results.Ok(LogFood(store, u, item));
});

// Scan a barcode → Open Food Facts product nutrition, logged as a meal.
app.MapGet("/api/food/barcode/{code}", async (string code, double? grams, HttpRequest http, UserStore store, FoodService food) =>
{
    var u = Auth(http, store);
    if (u is null) return Results.Json(new { error = "unauthorized" }, statusCode: 401);
    if (u.Targets is null) return Results.BadRequest(new { error = "no_profile" });
    var r = await food.LookupBarcodeAsync(code, grams ?? 0);
    if (r is null) return Results.NotFound(new { error = "product_not_found" });
    return Results.Ok(LogFood(store, u, r));
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
record FoodSearchRequest(string Query, double Grams);
