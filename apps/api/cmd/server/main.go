package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/creatoros/platform/apps/api/internal/platform/config"
	platformhttp "github.com/creatoros/platform/apps/api/internal/platform/http"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           platformhttp.NewRouter(logger),
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
