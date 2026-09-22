package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment         string
	Port                string
	DatabaseURL         string
	RedisURL            string
	AllowedOrigins      []string
	CookieSecure        bool
	PublicWebURL        string
	OutboxEncryptionKey string
	SMTPHost            string
	SMTPPort            string
	SMTPUsername        string
	SMTPPassword        string
	SMTPFrom            string
	ReadHeaderTimeout   time.Duration
	ReadTimeout         time.Duration
	WriteTimeout        time.Duration
	IdleTimeout         time.Duration
}

func Load() (Config, error) {
	environment := strings.ToLower(valueOrDefault("APP_ENV", "local"))
	cookieSecure := environment == "production"
	if raw, exists := os.LookupEnv("COOKIE_SECURE"); exists && raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			return Config{}, fmt.Errorf("COOKIE_SECURE must be true or false")
		}
		cookieSecure = parsed
	}
	config := Config{
		Environment:         environment,
		Port:                valueOrDefault("API_PORT", "8080"),
		DatabaseURL:         valueOrDefault("DATABASE_URL", "postgres://creatoros:creatoros_local_only@localhost:5432/creatoros?sslmode=disable"),
		RedisURL:            valueOrDefault("REDIS_URL", "redis://localhost:6379/0"),
		AllowedOrigins:      splitValues(valueOrDefault("WEB_ORIGINS", "http://localhost:3000,http://localhost:3001")),
		CookieSecure:        cookieSecure,
		PublicWebURL:        strings.TrimSpace(os.Getenv("PUBLIC_WEB_URL")),
		OutboxEncryptionKey: strings.TrimSpace(os.Getenv("OUTBOX_ENCRYPTION_KEY")),
		SMTPHost:            strings.TrimSpace(os.Getenv("SMTP_HOST")),
		SMTPPort:            valueOrDefault("SMTP_PORT", "587"),
		SMTPUsername:        strings.TrimSpace(os.Getenv("SMTP_USERNAME")),
		SMTPPassword:        os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:            strings.TrimSpace(os.Getenv("SMTP_FROM")),
		ReadHeaderTimeout:   5 * time.Second,
		ReadTimeout:         15 * time.Second,
		WriteTimeout:        30 * time.Second,
		IdleTimeout:         60 * time.Second,
	}
	if environment == "production" {
		if !config.CookieSecure {
			return Config{}, fmt.Errorf("COOKIE_SECURE cannot be false in production")
		}
		if config.SMTPHost != "" {
			if err := validateProductionEmail(config); err != nil {
				return Config{}, err
			}
		}
	} else if emailConfigPresent(config) && !config.EmailDeliveryEnabled() {
		return Config{}, fmt.Errorf("email delivery configuration is incomplete")
	}
	return config, nil
}

func emailConfigPresent(config Config) bool {
	return config.OutboxEncryptionKey != "" || config.SMTPHost != "" ||
		config.SMTPUsername != "" || config.SMTPPassword != "" || config.SMTPFrom != ""
}

func (config Config) EmailDeliveryEnabled() bool {
	return config.PublicWebURL != "" && config.OutboxEncryptionKey != "" && config.SMTPHost != "" && config.SMTPFrom != ""
}

func validateProductionEmail(config Config) error {
	missing := make([]string, 0, 4)
	for name, value := range map[string]string{
		"PUBLIC_WEB_URL": config.PublicWebURL, "OUTBOX_ENCRYPTION_KEY": config.OutboxEncryptionKey,
		"SMTP_HOST": config.SMTPHost, "SMTP_FROM": config.SMTPFrom,
	} {
		if value == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("production email delivery requires %s", strings.Join(missing, ", "))
	}
	origin, err := url.Parse(config.PublicWebURL)
	if err != nil || origin.Scheme != "https" || origin.Host == "" || origin.RawQuery != "" || origin.Fragment != "" {
		return fmt.Errorf("PUBLIC_WEB_URL must be an HTTPS origin in production")
	}
	return nil
}

func splitValues(value string) []string {
	parts := strings.Split(value, ",")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			values = append(values, trimmed)
		}
	}
	return values
}

func valueOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
