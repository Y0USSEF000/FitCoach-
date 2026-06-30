using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace FitWolf.Api.Services;

/// <summary>Email verification codes, password hashing, and access tokens.</summary>
public class AuthService
{
    // email (lowercased) -> (code, expiry)
    private readonly ConcurrentDictionary<string, (string Code, DateTime Expiry)> _codes = new();

    public static string Normalize(string email) => (email ?? "").Trim().ToLowerInvariant();

    public static bool IsValidEmail(string email)
    {
        email = (email ?? "").Trim();
        return email.Length >= 5 && email.Contains('@') && email.Contains('.') && !email.Contains(' ');
    }

    // ── 6-digit codes ──
    public string IssueCode(string email)
    {
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        _codes[Normalize(email)] = (code, DateTime.UtcNow.AddMinutes(10));
        return code;
    }

    public bool VerifyCode(string email, string code)
    {
        if (!_codes.TryGetValue(Normalize(email), out var e)) return false;
        if (DateTime.UtcNow > e.Expiry) { _codes.TryRemove(Normalize(email), out _); return false; }
        if (e.Code != (code ?? "").Trim()) return false;
        _codes.TryRemove(Normalize(email), out _);
        return true;
    }

    // ── Passwords (PBKDF2 / SHA256) ──
    public (string Hash, string Salt) HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100_000, HashAlgorithmName.SHA256, 32);
        return (Convert.ToBase64String(hash), Convert.ToBase64String(salt));
    }

    public bool VerifyPassword(string password, string hash, string salt)
    {
        if (string.IsNullOrEmpty(hash) || string.IsNullOrEmpty(salt)) return false;
        var computed = Rfc2898DeriveBytes.Pbkdf2(password, Convert.FromBase64String(salt), 100_000, HashAlgorithmName.SHA256, 32);
        return CryptographicOperations.FixedTimeEquals(computed, Convert.FromBase64String(hash));
    }

    // ── Tokens ──
    public string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(24));
}
