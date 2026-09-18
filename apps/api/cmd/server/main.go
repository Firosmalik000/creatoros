package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	authrepository "github.com/creatoros/platform/apps/api/internal/auth/repository"
	authservice "github.com/creatoros/platform/apps/api/internal/auth/service"
	"github.com/creatoros/platform/apps/api/internal/platform/config"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	platformhttp "github.com/creatoros/platform/apps/api/internal/platform/http"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	startupContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := database.Open(startupContext, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	authRepository := authrepository.NewPostgres(pool)
	authService := authservice.New(authRepository, authservice.DefaultConfig())
	authHandler := authhandler.New(authService, logger, cfg.Environment, cfg.CookieSecure)
	server := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: platformhttp.NewRouter(logger, platformhttp.Options{
			Auth:           authHandler,
			AllowedOrigins: cfg.AllowedOrigins,
			Readiness:      pool.Ping,
		}),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}

	logger.Info("api server starting", "port", cfg.Port, "environment", cfg.Environment)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("api server stopped", "error", err)
		os.Exit(1)
	}
}
