package notification

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/creatoros/platform/apps/api/internal/auth/domain"
)

type Payload struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type Factory struct {
	origin string
	aead   cipher.AEAD
}

func NewFactory(origin, encodedKey string) (*Factory, error) {
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil ||
		(parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, fmt.Errorf("PUBLIC_WEB_URL must be an absolute origin without query or fragment")
	}
	key, err := base64.StdEncoding.DecodeString(encodedKey)
	if err != nil || len(key) != 32 {
		return nil, fmt.Errorf("OUTBOX_ENCRYPTION_KEY must be base64-encoded 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("create outbox cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create outbox AEAD: %w", err)
	}
	return &Factory{origin: strings.TrimRight(origin, "/"), aead: aead}, nil
}

func (factory *Factory) Verification(email, locale, token string, expiresAt time.Time) (*domain.EmailOutboxMessage, error) {
	link := fmt.Sprintf("%s/%s/auth/verify-email?token=%s", factory.origin, locale, url.QueryEscape(token))
	subject, body := verificationCopy(locale, link)
	return factory.encrypt(email, "email_verification", locale, expiresAt, Payload{Subject: subject, Body: body})
}

func (factory *Factory) PasswordReset(email, locale, token string, expiresAt time.Time) (*domain.EmailOutboxMessage, error) {
	link := fmt.Sprintf("%s/%s/auth/reset-password?token=%s", factory.origin, locale, url.QueryEscape(token))
	subject, body := passwordResetCopy(locale, link)
	return factory.encrypt(email, "password_reset", locale, expiresAt, Payload{Subject: subject, Body: body})
}

func (factory *Factory) Decrypt(ciphertext, nonce []byte) (Payload, error) {
	plain, err := factory.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return Payload{}, fmt.Errorf("decrypt outbox payload: %w", err)
	}
	var payload Payload
	if err := json.Unmarshal(plain, &payload); err != nil {
		return Payload{}, fmt.Errorf("decode outbox payload: %w", err)
	}
	if payload.Subject == "" || payload.Body == "" {
		return Payload{}, fmt.Errorf("outbox payload is incomplete")
	}
	return payload, nil
}

func (factory *Factory) encrypt(recipient, kind, locale string, expiresAt time.Time, payload Payload) (*domain.EmailOutboxMessage, error) {
	plain, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("encode outbox payload: %w", err)
	}
	nonce := make([]byte, factory.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("create outbox nonce: %w", err)
	}
	return &domain.EmailOutboxMessage{
		Recipient:  recipient,
		Kind:       kind,
		Locale:     locale,
		Ciphertext: factory.aead.Seal(nil, nonce, plain, nil),
		Nonce:      nonce,
		ExpiresAt:  expiresAt,
	}, nil
}

func verificationCopy(locale, link string) (string, string) {
	switch locale {
	case "en":
		return "Verify your CreatorOS email", "Complete your registration by opening this link:\n\n" + link + "\n\nThis link expires in 24 hours."
	case "ms":
		return "Sahkan e-mel CreatorOS anda", "Lengkapkan pendaftaran dengan membuka pautan ini:\n\n" + link + "\n\nPautan ini tamat tempoh dalam 24 jam."
	default:
		return "Verifikasi email CreatorOS Anda", "Selesaikan pendaftaran dengan membuka tautan berikut:\n\n" + link + "\n\nTautan ini berlaku selama 24 jam."
	}
}

func passwordResetCopy(locale, link string) (string, string) {
	switch locale {
	case "en":
		return "Reset your CreatorOS password", "Reset your password by opening this link:\n\n" + link + "\n\nThis link expires in 30 minutes. Ignore this email if you did not request it."
	case "ms":
		return "Tetapkan semula kata laluan CreatorOS", "Tetapkan semula kata laluan dengan membuka pautan ini:\n\n" + link + "\n\nPautan ini tamat tempoh dalam 30 minit. Abaikan e-mel ini jika anda tidak memintanya."
	default:
		return "Atur ulang kata sandi CreatorOS", "Atur ulang kata sandi dengan membuka tautan berikut:\n\n" + link + "\n\nTautan ini berlaku selama 30 menit. Abaikan email ini jika Anda tidak memintanya."
	}
}
