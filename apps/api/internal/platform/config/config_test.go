package config

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestProductionDefaultsToSecureCookie(t *testing.T) {
	setProductionEnvironment(t)
	config, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if !config.CookieSecure {
		t.Fatal("production cookie must default to secure")
	}
}

func TestProductionRejectsInsecureCookie(t *testing.T) {
	setProductionEnvironment(t)
	t.Setenv("COOKIE_SECURE", "false")
	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "cannot be false") {
		t.Fatalf("expected production cookie error, got %v", err)
	}
}

func TestLocalDefaultsToInsecureCookie(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	t.Setenv("COOKIE_SECURE", "")
	config, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if config.CookieSecure {
		t.Fatal("local cookie must default to insecure for HTTP development")
	}
}

func TestPartialLocalEmailConfigurationIsRejected(t *testing.T) {
	t.Setenv("APP_ENV", "local")
	t.Setenv("SMTP_HOST", "smtp.example")
	_, err := Load()
	if err == nil || !strings.Contains(err.Error(), "incomplete") {
		t.Fatalf("expected incomplete email configuration error, got %v", err)
	}
}

func setProductionEnvironment(t *testing.T) {
	t.Helper()
	t.Setenv("APP_ENV", "production")
	t.Setenv("COOKIE_SECURE", "")
	t.Setenv("PUBLIC_WEB_URL", "https://creator.example")
	t.Setenv("OUTBOX_ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(make([]byte, 32)))
	t.Setenv("SMTP_HOST", "smtp.example")
	t.Setenv("SMTP_FROM", "noreply@creator.example")
}
