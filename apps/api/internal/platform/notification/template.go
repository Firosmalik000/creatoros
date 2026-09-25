package notification

import (
	"fmt"
	"strings"
)

type emailData struct {
	Title       string
	Subtitle    string
	Message     string
	ButtonText  string
	ButtonURL   string
	ExpiryNotice string
	SecurityNote string
	FooterCopy  string
}

func renderEmailHTML(data emailData) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>%s</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%%" border="0" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #09090b; padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;">CREATOROS</h1>
              <p style="margin: 6px 0 0 0; color: #a1a1aa; font-size: 12px; letter-spacing: 1px;">Agency & Creator Operating System</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 40px 32px 40px;">
              <h2 style="margin: 0 0 8px 0; color: #0f172a; font-size: 22px; font-weight: 700;">%s</h2>
              <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px;">%s</p>
              <p style="margin: 0 0 32px 0; color: #334155; font-size: 15px; line-height: 1.6;">%s</p>
              
              <!-- Call to Action Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 32px auto;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #0f172a;">
                    <a href="%s" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #0f172a; letter-spacing: 0.3px;">
                      %s
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct URL -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Atau salin tautan berikut ke browser:</p>
                <a href="%s" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #2563eb; word-break: break-all; text-decoration: underline;">%s</a>
              </div>

              <!-- Security Notice -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #64748b; line-height: 1.5;">
                <p style="margin: 0 0 4px 0;">⏱️ <strong>Catatan:</strong> %s</p>
                <p style="margin: 0; color: #94a3b8; font-size: 12px;">%s</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 40px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8;">&copy; 2026 CreatorOS Platform. Hak cipta dilindungi undang-undang.</p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">Pesan ini dikirim secara otomatis oleh sistem CreatorOS. Harap tidak membalas email ini.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
		data.Title,
		data.Title,
		data.Subtitle,
		data.Message,
		data.ButtonURL,
		data.ButtonText,
		data.ButtonURL,
		data.ButtonURL,
		data.ExpiryNotice,
		data.SecurityNote,
	)
}

func getVerificationEmail(locale, link string) (string, string) {
	switch strings.ToLower(locale) {
	case "en":
		return "Verify your CreatorOS email address", renderEmailHTML(emailData{
			Title:        "Welcome to CreatorOS!",
			Subtitle:     "One last step to activate your account",
			Message:      "Thank you for signing up with CreatorOS. To complete your registration and begin collaborating with top creators and agencies, please verify your email address by clicking the button below:",
			ButtonText:   "Verify Email Address",
			ButtonURL:    link,
			ExpiryNotice: "This verification link is valid for 24 hours.",
			SecurityNote: "If you did not create an account on CreatorOS, please disregard this email. Your email address remains safe.",
		})
	case "ms":
		return "Sahkan alamat e-mel CreatorOS anda", renderEmailHTML(emailData{
			Title:        "Selamat Datang ke CreatorOS!",
			Subtitle:     "Satu langkah lagi untuk mengaktifkan akaun anda",
			Message:      "Terima kasih kerana menyertai CreatorOS. Sila sahkan alamat e-mel anda untuk melengkapkan proses pendaftaran dan mula berhubung dengan pencipta kandungan terbaik:",
			ButtonText:   "Sahkan Alamat E-mel",
			ButtonURL:    link,
			ExpiryNotice: "Pautan pengesahan ini sah untuk tempoh 24 jam.",
			SecurityNote: "Jika anda tidak pernah mendaftar di CreatorOS, sila abaikan e-mel ini.",
		})
	default:
		return "Verifikasi Alamat Email CreatorOS Anda", renderEmailHTML(emailData{
			Title:        "Selamat Datang di CreatorOS!",
			Subtitle:     "Satu langkah terakhir untuk mengaktifkan akun Anda",
			Message:      "Terima kasih telah bergabung dengan platform CreatorOS. Untuk menyelesaikan proses pendaftaran dan mulai menjelajahi kreator serta layanan terbaik, silakan verifikasi alamat email Anda melalui tombol di bawah ini:",
			ButtonText:   "Verifikasi Alamat Email",
			ButtonURL:    link,
			ExpiryNotice: "Tautan verifikasi ini berlaku selama 24 jam.",
			SecurityNote: "Jika Anda merasa tidak pernah mendaftar di CreatorOS, abaikan email ini dengan aman.",
		})
	}
}

func getPasswordResetEmail(locale, link string) (string, string) {
	switch strings.ToLower(locale) {
	case "en":
		return "Reset your CreatorOS password", renderEmailHTML(emailData{
			Title:        "Reset Your Password",
			Subtitle:     "Password recovery request for CreatorOS",
			Message:      "We received a request to reset the password for your CreatorOS account. Click the button below to choose a new, secure password:",
			ButtonText:   "Reset Password",
			ButtonURL:    link,
			ExpiryNotice: "This password reset link is valid for 30 minutes.",
			SecurityNote: "If you did not request a password reset, please ignore this email. Your account remains completely secure.",
		})
	case "ms":
		return "Tetapkan semula kata laluan CreatorOS", renderEmailHTML(emailData{
			Title:        "Tetapkan Semula Kata Laluan",
			Subtitle:     "Permintaan menetapkan semula kata laluan CreatorOS",
			Message:      "Kami menerima permintaan untuk menetapkan semula kata laluan akaun CreatorOS anda. Klik butang di bawah untuk menetapkan kata laluan baharu:",
			ButtonText:   "Tetapkan Kata Laluan",
			ButtonURL:    link,
			ExpiryNotice: "Pautan ini sah selama 30 minit demi keselamatan akaun anda.",
			SecurityNote: "Jika anda tidak meminta penetapan ini, sila abaikan e-mel ini.",
		})
	default:
		return "Atur Ulang Kata Sandi CreatorOS Anda", renderEmailHTML(emailData{
			Title:        "Atur Ulang Kata Sandi",
			Subtitle:     "Permintaan pemulihan kata sandi akun CreatorOS",
			Message:      "Kami menerima permintaan untuk mengatur ulang kata sandi akun CreatorOS Anda. Klik tombol di bawah ini untuk membuat kata sandi baru yang aman:",
			ButtonText:   "Atur Ulang Kata Sandi",
			ButtonURL:    link,
			ExpiryNotice: "Tautan ini hanya berlaku selama 30 menit demi keamanan akun Anda.",
			SecurityNote: "Jika Anda tidak pernah meminta pengaturan ulang kata sandi, abaikan email ini. Akun Anda tetap aman.",
		})
	}
}
