#!/usr/bin/env bash
set -euo pipefail

# CreatorOS Pilot Cohort Seeder Script
DATABASE_URL="${DATABASE_URL:-postgres://creatoros:creatoros_local_only@localhost:5432/creatoros?sslmode=disable}"
CLEAN_FLAG="${1:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="${SCRIPT_DIR}/../apps/api"

echo "Seeding CreatorOS Pilot Cohort Data..."
cd "${API_DIR}"
export DATABASE_URL

if [ "${CLEAN_FLAG}" = "--clean" ] || [ "${CLEAN_FLAG}" = "-clean" ]; then
  go run ./cmd/seed -clean
else
  go run ./cmd/seed
fi

echo "Database seeding completed successfully!"
