package migrate

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const advisoryLockID int64 = 621974631

type migration struct {
	version int64
	path    string
}

func Up(ctx context.Context, pool *pgxpool.Pool, directory string) error {
	connection, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer connection.Release()

	if _, err := connection.Exec(ctx, "SELECT pg_advisory_lock($1)", advisoryLockID); err != nil {
		return fmt.Errorf("lock migrations: %w", err)
	}
	defer func() {
		_, _ = connection.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", advisoryLockID)
	}()

	if err := ensureTable(ctx, connection); err != nil {
		return err
	}

	migrations, err := findMigrations(directory, ".up.sql")
	if err != nil {
		return err
	}

	for _, item := range migrations {
		var applied bool
		if err := connection.QueryRow(ctx,
			"SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)",
			item.version,
		).Scan(&applied); err != nil {
			return fmt.Errorf("check migration %d: %w", item.version, err)
		}
		if applied {
			continue
		}

		contents, err := os.ReadFile(item.path)
		if err != nil {
			return fmt.Errorf("read migration %d: %w", item.version, err)
		}
		if err := apply(ctx, connection, item.version, string(contents)); err != nil {
			return err
		}
	}

	return nil
}

func Down(ctx context.Context, pool *pgxpool.Pool, directory string, steps int) error {
	if steps < 1 {
		return fmt.Errorf("down migration steps must be at least one")
	}

	connection, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire migration connection: %w", err)
	}
	defer connection.Release()

	if _, err := connection.Exec(ctx, "SELECT pg_advisory_lock($1)", advisoryLockID); err != nil {
		return fmt.Errorf("lock migrations: %w", err)
	}
	defer func() {
		_, _ = connection.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", advisoryLockID)
	}()

	if err := ensureTable(ctx, connection); err != nil {
		return err
	}

	downMigrations, err := findMigrations(directory, ".down.sql")
	if err != nil {
		return err
	}
	byVersion := make(map[int64]string, len(downMigrations))
	for _, item := range downMigrations {
		byVersion[item.version] = item.path
	}

	rows, err := connection.Query(ctx,
		"SELECT version FROM schema_migrations ORDER BY version DESC LIMIT $1",
		steps,
	)
	if err != nil {
		return fmt.Errorf("list applied migrations: %w", err)
	}
	versions, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		return fmt.Errorf("collect applied migrations: %w", err)
	}

	for _, version := range versions {
		path, ok := byVersion[version]
		if !ok {
			return fmt.Errorf("down migration %d is missing", version)
		}
		contents, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read down migration %d: %w", version, err)
		}
		if err := rollback(ctx, connection, version, string(contents)); err != nil {
			return err
		}
	}

	return nil
}

func ensureTable(ctx context.Context, connection *pgxpool.Conn) error {
	_, err := connection.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version bigint PRIMARY KEY,
			applied_at timestamptz NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return fmt.Errorf("ensure schema migrations table: %w", err)
	}
	return nil
}

func apply(ctx context.Context, connection *pgxpool.Conn, version int64, sql string) error {
	tx, err := connection.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin migration %d: %w", version, err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if _, err := tx.Exec(ctx, sql); err != nil {
		return fmt.Errorf("apply migration %d: %w", version, err)
	}
	if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
		return fmt.Errorf("record migration %d: %w", version, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit migration %d: %w", version, err)
	}
	return nil
}

func rollback(ctx context.Context, connection *pgxpool.Conn, version int64, sql string) error {
	tx, err := connection.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin rollback %d: %w", version, err)
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if _, err := tx.Exec(ctx, sql); err != nil {
		return fmt.Errorf("rollback migration %d: %w", version, err)
	}
	if _, err := tx.Exec(ctx, "DELETE FROM schema_migrations WHERE version = $1", version); err != nil {
		return fmt.Errorf("remove migration record %d: %w", version, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit rollback %d: %w", version, err)
	}
	return nil
}

func findMigrations(directory, suffix string) ([]migration, error) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return nil, fmt.Errorf("read migrations directory: %w", err)
	}

	items := make([]migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), suffix) {
			continue
		}
		prefix, _, ok := strings.Cut(entry.Name(), "_")
		if !ok {
			return nil, fmt.Errorf("migration filename %q has no numeric prefix", entry.Name())
		}
		version, err := strconv.ParseInt(prefix, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("migration filename %q has invalid version: %w", entry.Name(), err)
		}
		items = append(items, migration{version: version, path: filepath.Join(directory, entry.Name())})
	}

	sort.Slice(items, func(left, right int) bool { return items[left].version < items[right].version })
	return items, nil
}
