package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	Environment       string
	Port              string
	DatabaseURL       string
	AllowedOrigins    []string
	CookieSecure      bool
	ReadHeaderTimeout time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
}

func Load() Config {
	return Config{
		Environment:       valueOrDefault("APP_ENV", "local"),
		Port:              valueOrDefault("API_PORT", "8080"),
		DatabaseURL:       valueOrDefault("DATABASE_URL", "postgres://creatoros:creatoros_local_only@localhost:5432/creatoros?sslmode=disable"),
		AllowedOrigins:    splitValues(valueOrDefault("WEB_ORIGINS", "http://localhost:3000,http://localhost:3001")),
		CookieSecure:      valueOrDefault("COOKIE_SECURE", "false") == "true",
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
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
