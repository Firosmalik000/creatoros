package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/creatoros/platform/apps/api/internal/platform/database"
	"github.com/creatoros/platform/apps/api/internal/platform/migrate"
)

func main() {
	direction := flag.String("direction", "up", "migration direction: up or down")
	directory := flag.String("dir", "./migrations", "directory containing migration files")
	steps := flag.Int("steps", 1, "number of migrations to roll back")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		logger.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	pool, err := database.Open(ctx, databaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	switch *direction {
	case "up":
		err = migrate.Up(ctx, pool, *directory)
	case "down":
		err = migrate.Down(ctx, pool, *directory, *steps)
	default:
		err = fmt.Errorf("unsupported migration direction %q", *direction)
	}
	if err != nil {
		logger.Error("migration failed", "direction", *direction, "error", err)
		os.Exit(1)
	}

	logger.Info("migration completed", "direction", *direction)
}
