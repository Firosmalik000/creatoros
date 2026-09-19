package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	authhandler "github.com/creatoros/platform/apps/api/internal/auth/handler"
	authrepository "github.com/creatoros/platform/apps/api/internal/auth/repository"
	authservice "github.com/creatoros/platform/apps/api/internal/auth/service"
	creatorhandler "github.com/creatoros/platform/apps/api/internal/creator/handler"
	creatorrepository "github.com/creatoros/platform/apps/api/internal/creator/repository"
	creatorservice "github.com/creatoros/platform/apps/api/internal/creator/service"
	"github.com/creatoros/platform/apps/api/internal/platform/config"
	"github.com/creatoros/platform/apps/api/internal/platform/database"
	platformhttp "github.com/creatoros/platform/apps/api/internal/platform/http"
	"github.com/creatoros/platform/apps/api/internal/platform/notification"
	"github.com/creatoros/platform/apps/api/internal/platform/ratelimit"
	servicehandler "github.com/creatoros/platform/apps/api/internal/service/handler"
	servicerepository "github.com/creatoros/platform/apps/api/internal/service/repository"
	serviceservice "github.com/creatoros/platform/apps/api/internal/service/service"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("configuration is invalid", "error", err)
		os.Exit(1)
	}
	startupContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := database.Open(startupContext, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database startup failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	limiter, err := ratelimit.New(cfg.RedisURL)
	if err != nil {
		logger.Error("rate limiter startup failed", "error", err)
		os.Exit(1)
	}
	defer limiter.Close()
	if err := limiter.Ping(startupContext); err != nil {
		logger.Error("redis startup failed", "error", err)
		os.Exit(1)
	}

	authRepository := authrepository.NewPostgres(pool)
	serviceConfig := authservice.DefaultConfig()
	if cfg.EmailDeliveryEnabled() {
		factory, err := notification.NewFactory(cfg.PublicWebURL, cfg.OutboxEncryptionKey)
		if err != nil {
			logger.Error("notification startup failed", "error", err)
			os.Exit(1)
		}
		serviceConfig.Notifications = factory
		sender := notification.NewSMTPSender(notification.SMTPConfig{
			Host: cfg.SMTPHost, Port: cfg.SMTPPort, Username: cfg.SMTPUsername,
			Password: cfg.SMTPPassword, From: cfg.SMTPFrom,
		})
		go notification.NewWorker(pool, factory, sender, logger).Run(context.Background())
	}
	authService := authservice.New(authRepository, serviceConfig)
	authHandler := authhandler.New(authService, logger, authhandler.Options{
		Environment: cfg.Environment, CookieSecure: cfg.CookieSecure, RateLimiter: limiter,
	})
	creatorRepository := creatorrepository.NewPostgres(pool)
	creatorService := creatorservice.New(creatorRepository)
	creatorHandler := creatorhandler.New(creatorService, logger)
	serviceRepository := servicerepository.NewPostgres(pool)
	serviceService := serviceservice.New(serviceRepository)
	serviceHandler := servicehandler.New(serviceService, logger)
	server := &http.Server{
		Addr: ":" + cfg.Port,
		Handler: platformhttp.NewRouter(logger, platformhttp.Options{
			Auth:           authHandler,
			Creator:        creatorHandler,
			Service:        serviceHandler,
			AllowedOrigins: cfg.AllowedOrigins,
			Readiness: func(ctx context.Context) error {
				return errors.Join(pool.Ping(ctx), limiter.Ping(ctx))
			},
		}),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		MaxHeaderBytes:    1 << 20,
	}

	logger.Info("api server starting", "port", cfg.Port, "environment", cfg.Environment)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("api server stopped", "error", err)
		os.Exit(1)
	}
}
