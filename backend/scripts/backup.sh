#!/usr/bin/env sh
# ==============================================================================
# gacha PostgreSQL Automated Backup Script
# Creates a compressed, dated pg_dump file of the database.
#
# Recommended cron entry on the DigitalOcean droplet:
# 0 2 * * * /path/to/gacha/backend/scripts/backup.sh >> /var/log/gacha-backup.log 2>&1
# ==============================================================================

set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/gacha}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/gacha_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting gacha database backup..."

# If running alongside Docker compose:
if command -v docker >/dev/null 2>&1; then
  docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-gacha}" | gzip > "${BACKUP_FILE}"
else
  pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-gacha}" | gzip > "${BACKUP_FILE}"
fi

BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup successful: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Prune old backups older than retention window
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "gacha_backup_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup maintenance complete."
