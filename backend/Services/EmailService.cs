using System.Net;
using System.Net.Mail;
using System.Net.Mime;

namespace YsfCoach.Api.Services;

/// <summary>
/// Sends a branded HTML verification email (logo + mascot embedded via CID).
/// Configure SMTP in appsettings.json under "Smtp". If not configured, the code
/// is only logged to the console (dev mode).
/// </summary>
public class EmailService
{
    private readonly IConfiguration _cfg;
    private readonly ILogger<EmailService> _log;

    public EmailService(IConfiguration cfg, ILogger<EmailService> log) { _cfg = cfg; _log = log; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_cfg["Smtp:Host"]) && !string.IsNullOrWhiteSpace(_cfg["Smtp:User"]);

    private static string AssetPath(string file) => Path.Combine(AppContext.BaseDirectory, "assets", file);

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

            var logoPath = AssetPath("wolf-logo.png");
            var mascotPath = AssetPath("wolf-mascot.png");
            bool hasLogo = File.Exists(logoPath);
            bool hasMascot = File.Exists(mascotPath);

            var logoTag = hasLogo
                ? "<img src=\"cid:wolflogo\" width=\"96\" height=\"96\" alt=\"FitWolf\" style=\"display:block;border-radius:50%;\" />"
                : "<div style=\"font-size:54px\">🐺</div>";
            var mascotTag = hasMascot
                ? "<img src=\"cid:wolfmascot\" width=\"190\" alt=\"FitWolf mascot\" style=\"display:block;margin:0 auto;\" />"
                : "";

            var html = BuildHtml(code, logoTag, mascotTag);

            using var msg = new MailMessage(from, toEmail)
            {
                Subject = "🐺 Your FitWolf code: " + code,
            };

            // plain-text fallback
            msg.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
                $"FitWolf\n\nYour verification code is: {code}\n\nIt expires in 10 minutes.\nIf you didn't request this, ignore this email.",
                null, MediaTypeNames.Text.Plain));

            // HTML view with embedded images
            var htmlView = AlternateView.CreateAlternateViewFromString(html, null, MediaTypeNames.Text.Html);
            if (hasLogo)
            {
                var lr = new LinkedResource(logoPath, "image/png") { ContentId = "wolflogo" };
                lr.ContentType.Name = "wolf-logo.png";
                htmlView.LinkedResources.Add(lr);
            }
            if (hasMascot)
            {
                var lr = new LinkedResource(mascotPath, "image/png") { ContentId = "wolfmascot" };
                lr.ContentType.Name = "wolf-mascot.png";
                htmlView.LinkedResources.Add(lr);
            }
            msg.AlternateViews.Add(htmlView);

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

    private static string BuildHtml(string code, string logoTag, string mascotTag)
    {
        // Space the digits for readability: 1 2 3 4 5 6
        var spaced = string.Join("&nbsp;", code.ToCharArray());

        return $@"
<!DOCTYPE html>
<html>
<body style=""margin:0;padding:0;background:#0c0818;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#0c0818;padding:28px 12px;"">
    <tr><td align=""center"">
      <table role=""presentation"" width=""480"" cellpadding=""0"" cellspacing=""0""
             style=""max-width:480px;width:100%;background:#16102a;border:1px solid #2a1f48;border-radius:22px;overflow:hidden;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;"">

        <!-- Header band with logo avatar -->
        <tr><td align=""center"" style=""background:#7c3aed;padding:26px 20px 22px;"">
          <table role=""presentation"" cellpadding=""0"" cellspacing=""0""><tr><td align=""center"">
            <div style=""background:#ffffff22;width:104px;height:104px;border-radius:50%;display:inline-block;line-height:104px;border:3px solid #ffffff55;"">
              {logoTag}
            </div>
            <div style=""color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;margin-top:12px;"">Fit<span style=""color:#ede9ff;"">Wolf</span></div>
            <div style=""color:#ede9ff;font-size:12px;font-weight:700;letter-spacing:2px;margin-top:2px;"">TRAIN. FOCUS. TRANSFORM.</div>
          </td></tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td align=""center"" style=""padding:30px 28px 8px;"">
          <div style=""color:#ede9ff;font-size:20px;font-weight:800;"">Verify your email</div>
          <div style=""color:#9d8ec4;font-size:14px;margin-top:8px;line-height:20px;"">
            Welcome to the pack! Enter this code in the app to confirm it's really you.
          </div>
        </td></tr>

        <!-- Code box -->
        <tr><td align=""center"" style=""padding:18px 28px 6px;"">
          <div style=""display:inline-block;background:#0c0818;border:2px solid #7c3aed;border-radius:16px;padding:18px 26px;"">
            <div style=""color:#a855f7;font-size:11px;font-weight:800;letter-spacing:2px;margin-bottom:6px;"">YOUR VERIFICATION CODE</div>
            <div style=""color:#ffffff;font-size:40px;font-weight:900;letter-spacing:10px;"">{spaced}</div>
          </div>
          <div style=""color:#5a4e7a;font-size:12px;font-weight:600;margin-top:12px;"">⏱ Expires in 10 minutes</div>
        </td></tr>

        <!-- Mascot -->
        <tr><td align=""center"" style=""padding:14px 20px 2px;"">
          {mascotTag}
          <div style=""color:#c4b5fd;font-size:15px;font-weight:800;margin-top:6px;"">Let's crush your goals! 💪</div>
        </td></tr>

        <!-- Footer -->
        <tr><td align=""center"" style=""padding:20px 28px 26px;border-top:1px solid #2a1f48;"">
          <div style=""color:#5a4e7a;font-size:12px;line-height:18px;"">
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
