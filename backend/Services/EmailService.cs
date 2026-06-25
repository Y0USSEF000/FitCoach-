using System.Net;
using System.Net.Mail;

namespace YsfCoach.Api.Services;

/// <summary>
/// Sends the verification code by email via SMTP.
/// Configure in appsettings.json under "Smtp". If not configured, falls back to
/// logging the code to the console (so the flow is testable in dev).
/// </summary>
public class EmailService
{
    private readonly IConfiguration _cfg;
    private readonly ILogger<EmailService> _log;

    public EmailService(IConfiguration cfg, ILogger<EmailService> log) { _cfg = cfg; _log = log; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_cfg["Smtp:Host"]) && !string.IsNullOrWhiteSpace(_cfg["Smtp:User"]);

    public async Task<bool> SendCodeAsync(string toEmail, string code)
    {
        // Always log so dev can read the code from the backend window.
        _log.LogInformation("==================== FitWolf verification code for {Email}: {Code} ====================", toEmail, code);

        if (!IsConfigured) return false;

        try
        {
            var host = _cfg["Smtp:Host"]!;
            var port = int.TryParse(_cfg["Smtp:Port"], out var p) ? p : 587;
            var user = _cfg["Smtp:User"]!;
            var pass = _cfg["Smtp:Pass"] ?? "";
            var from = _cfg["Smtp:From"] ?? user;

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(user, pass),
            };
            var msg = new MailMessage(from, toEmail)
            {
                Subject = "Your FitWolf code",
                IsBodyHtml = true,
                Body =
                    $"<div style='font-family:sans-serif'>" +
                    $"<h2>🐺 FitWolf</h2>" +
                    $"<p>Your verification code is:</p>" +
                    $"<p style='font-size:32px;font-weight:800;letter-spacing:6px'>{code}</p>" +
                    $"<p style='color:#888'>It expires in 10 minutes.</p></div>",
            };
            await client.SendMailAsync(msg);
            _log.LogInformation("Verification email sent to {Email}", toEmail);
            return true;
        }
        catch (Exception e)
        {
            _log.LogError(e, "Failed to send email to {Email}", toEmail);
            return false;
        }
    }
}
