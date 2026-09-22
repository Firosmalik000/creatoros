#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${1:-creatoros-postgres-1}"
DB_NAME="${2:-creatoros}"
DB_USER="${3:-creatoros}"
OUTPUT_DIR="${4:-backups}"

mkdir -p "$OUTPUT_DIR"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILENAME="${DB_NAME}_backup_${TIMESTAMP}.dump"
HOST_PATH="${OUTPUT_DIR}/${FILENAME}"
CONTAINER_PATH="/tmp/${FILENAME}"

echo "Creating backup for database '${DB_NAME}'..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "$CONTAINER_PATH"
docker cp "${CONTAINER}:${CONTAINER_PATH}" "$HOST_PATH"
docker exec "$CONTAINER" rm -f "$CONTAINER_PATH"

echo "Backup completed successfully: ${HOST_PATH}"
