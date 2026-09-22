#!/usr/bin/env bash
set -euo pipefail

DUMP_FILE="${1:?Usage: $0 <dump_file> [container] [target_db] [user]}"
CONTAINER="${2:-creatoros-postgres-1}"
TARGET_DB="${3:-creatoros}"
DB_USER="${4:-creatoros}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: Dump file not found: $DUMP_FILE" >&2
  exit 1
fi

FILENAME="$(basename "$DUMP_FILE")"
CONTAINER_PATH="/tmp/${FILENAME}"

echo "Copying dump file to container..."
docker cp "$DUMP_FILE" "${CONTAINER}:${CONTAINER_PATH}"

echo "Restoring database '${TARGET_DB}' from '${FILENAME}'..."
docker exec "$CONTAINER" pg_restore -U "$DB_USER" -d "$TARGET_DB" --clean --if-exists "$CONTAINER_PATH" || true
docker exec "$CONTAINER" rm -f "$CONTAINER_PATH"

echo "Database restore finished!"
