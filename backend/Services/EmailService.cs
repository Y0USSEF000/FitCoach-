using System.Net;
using System.Net.Mail;
using System.Net.Mime;

namespace FitWolf.Api.Services;

/// <summary>
/// Sends a simple, text-first verification email. Kept deliberately light
/// (no embedded images, a real plain-text part, a Reply-To header) so spam
/// filters are more likely to place it in the inbox. Configure SMTP in
/// appsettings.json under "Smtp"; if not configured the code is only logged.
/// </summary>
public class EmailService
{
    private readonly IConfiguration _cfg;
    private readonly ILogger<EmailService> _log;

    public EmailService(IConfiguration cfg, ILogger<EmailService> log) { _cfg = cfg; _log = log; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_cfg["Smtp:Host"]) && !string.IsNullOrWhiteSpace(_cfg["Smtp:User"]);

    public async Task<bool> SendCodeAsync(string toEmail, string code)
    {
        _log.LogInformation("==================== FitWolf code for {Email}: {Code} ====================", toEmail, code);
        if (!IsConfigured) return false;

        try
        {
            var host = _cfg["Smtp:Host"]!;
            var port = int.TryParse(_cfg["Smtp:Port"], out var p) ? p : 587;
            var user = _cfg["Smtp:User"]!;
            var pass = _cfg["Smtp:Pass"] ?? "";
            var from = _cfg["Smtp:From"] ?? user;
            var fromName = _cfg["Smtp:FromName"] ?? "FitWolf";

            using var msg = new MailMessage(new MailAddress(from, fromName), new MailAddress(toEmail))
            {
                Subject = $"Your FitWolf code is {code}",
            };
            // A real Reply-To makes the sender look legitimate to spam filters.
            msg.ReplyToList.Add(new MailAddress(from, fromName));

            // Plain-text part first — text-first emails are trusted more than image-heavy ones.
            msg.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
                $"FitWolf\n\nYour verification code is: {code}\n\n" +
                "Enter it in the app to sign in. The code expires in 10 minutes.\n" +
                "If you didn't request this, you can ignore this email.",
                null, MediaTypeNames.Text.Plain));

            // Light, simple HTML — no embedded images.
            var html = BuildHtml(code);
            msg.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(html, null, MediaTypeNames.Text.Html));

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(user, pass),
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

    // Hosted (public) brand images — linked, not embedded, to stay light for spam filters.
    private const string LogoUrl   = "https://raw.githubusercontent.com/Y0USSEF000/FitCoach-/main/backend/assets/wolf-logo.png";
    private const string MascotUrl = "https://raw.githubusercontent.com/Y0USSEF000/FitCoach-/main/backend/assets/wolf-mascot.png";

    private static string BuildHtml(string code)
    {
        // Space the digits for readability: 1 2 3 4 5 6
        var spaced = string.Join("&nbsp;", code.ToCharArray());

        return $@"
<!DOCTYPE html>
<html>
<body style=""margin:0;padding:0;background:#f4f5f7;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#f4f5f7;padding:28px 12px;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;"">
    <tr><td align=""center"">
      <table role=""presentation"" width=""480"" cellpadding=""0"" cellspacing=""0""
             style=""max-width:480px;width:100%;background:#ffffff;border:1px solid #e6e7eb;border-radius:20px;overflow:hidden;"">

        <!-- Header band -->
        <tr><td align=""center"" style=""background:#7c3aed;padding:28px 24px 22px;"">
          <img src=""{LogoUrl}"" width=""80"" height=""80"" alt=""FitWolf""
               style=""display:block;border-radius:50%;border:3px solid #ffffff66;background:#ffffff22;"" />
          <div style=""color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;margin-top:12px;"">FitWolf</div>
          <div style=""color:#ede9ff;font-size:11px;font-weight:700;letter-spacing:2px;margin-top:3px;"">TRAIN · FOCUS · TRANSFORM</div>
        </td></tr>

        <!-- Title -->
        <tr><td align=""center"" style=""padding:28px 32px 4px;"">
          <div style=""color:#1a1a2e;font-size:20px;font-weight:800;"">Verify your email</div>
          <div style=""color:#6b6b80;font-size:14px;line-height:21px;margin-top:8px;"">
            Welcome to the pack! Enter this code in the app to confirm it's really you.
          </div>
        </td></tr>

        <!-- Code box -->
        <tr><td align=""center"" style=""padding:22px 32px 6px;"">
          <div style=""display:inline-block;background:#f6f3ff;border:2px solid #7c3aed;border-radius:14px;padding:16px 28px;"">
            <div style=""color:#7c3aed;font-size:11px;font-weight:800;letter-spacing:2px;margin-bottom:6px;"">YOUR CODE</div>
            <div style=""color:#1a1a2e;font-size:36px;font-weight:800;letter-spacing:8px;"">{spaced}</div>
          </div>
          <div style=""color:#9a9aac;font-size:12px;font-weight:600;margin-top:12px;"">⏱ Expires in 10 minutes</div>
        </td></tr>

        <!-- Mascot -->
        <tr><td align=""center"" style=""padding:16px 24px 4px;"">
          <img src=""{MascotUrl}"" width=""150"" alt=""FitWolf mascot"" style=""display:block;margin:0 auto;"" />
          <div style=""color:#7c3aed;font-size:15px;font-weight:800;margin-top:6px;"">Let's crush your goals! 💪</div>
        </td></tr>

        <!-- Footer -->
        <tr><td align=""center"" style=""padding:20px 32px 26px;border-top:1px solid #eeeff2;"">
          <div style=""color:#a0a0ad;font-size:12px;line-height:18px;"">
            If you didn't request this code, you can safely ignore this email.<br/>
            © FitWolf · Your AI nutrition coach
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>";
    }
}
