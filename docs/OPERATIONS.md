# Operations & Production Runbook

This document defines standard operating procedures, backup/restore runbooks, incident response flows, and monitoring health checks for the CreatorOS modular monolith.

---

## 1. System Health & Monitoring

The Go API exposes health endpoints for orchestrators and load balancers:

- `GET /health/live`: Fast process liveness probe. Returns HTTP 200 `{"data":{"status":"live","timestamp":"..."}}`.
- `GET /health/ready`: Deep readiness probe checking active connectivity to PostgreSQL and Redis. Returns HTTP 200 `ready` or HTTP 503 `not_ready` with a 2-second timeout fail-closed threshold.

### Service Ports

- **Web Frontend (Next.js):** Port 3000
- **API (Go Backend):** Port 8080
- **PostgreSQL Database:** Port 5432
- **Redis Cache & Queues:** Port 6379
- **MinIO Object Storage:** Port 9000 (API), Port 9001 (Console)

---

## 2. Database Backup Runbook

PostgreSQL is the single source of truth. Automated backups use `pg_dump` with custom compressed format (`-Fc`).

### Automated Backup Execution

Using PowerShell:
```powershell
.\scripts\backup.ps1 -ContainerName "creatoros-postgres-1" -DatabaseName "creatoros" -OutputDir "backups"
```

Using Bash:
```bash
./scripts/backup.sh creatoros-postgres-1 creatoros creatoros backups
```

### Retention Policy

- **Daily backups:** Retained for 30 days.
- **Weekly backups:** Retained for 12 weeks.
- **Monthly backups:** Retained for 1 year off-site in encrypted object storage.

---

## 3. Disaster Recovery & Database Restore Runbook

In the event of data corruption, accidental deletion, or disaster recovery:

1. **Halt traffic:** Direct incoming web traffic to maintenance page or stop Next.js frontend to prevent in-flight writes.
2. **Execute restore script:**
   ```powershell
   .\scripts\restore.ps1 -DumpFile "backups\creatoros_backup_YYYYMMDD_HHMMSS.dump" -TargetDatabase "creatoros"
   ```
   Or using Bash:
   ```bash
   ./scripts/restore.sh backups/creatoros_backup_YYYYMMDD_HHMMSS.dump creatoros-postgres-1 creatoros creatoros
   ```
3. **Verify database integrity:**
   ```bash
   docker exec creatoros-postgres-1 psql -U creatoros -d creatoros -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
   ```
   Expected minimum table count: 45 tables.
4. **Run migrations check:**
   Ensure database schema matches code release version via `cmd/migrate`.
5. **Resume traffic:** Restore normal traffic flow and monitor `/health/ready`.

---

## 4. Security & Incident Response

### Compromised Credentials / Session Revocation

If an account or administrative credential is suspected of compromise:
1. Revoke all user sessions immediately in the database or via Admin portal:
   ```sql
   UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = '<user_uuid>' AND revoked_at IS NULL;
   ```
2. Disable the user account:
   ```sql
   UPDATE users SET status = 'disabled' WHERE id = '<user_uuid>';
   ```
3. Check `audit_logs` for any privileged operations performed by the compromised actor:
   ```sql
   SELECT * FROM audit_logs WHERE actor_user_id = '<user_uuid>' ORDER BY created_at DESC;
   ```

### Secret Rotation

- **Session Secret (`SESSION_SECRET`):** Rotate during scheduled maintenance window. Invalidates active sessions and requires user re-login.
- **Outbox Encryption Key (`OUTBOX_ENCRYPTION_KEY`):** Must remain available to decrypt pending email outbox payloads before rotation.
- **Payment Webhook Secret (`PAYMENT_WEBHOOK_SECRET`):** Rotate synchronously with provider webhook configuration to prevent signature rejection.

---

## 5. Rate Limiting & Edge Protections

Redis-backed token-bucket rate limits protect sensitive endpoints:
- Registration, Login, and Password Reset: Account and IP-based rate limiting with `429 Too Many Requests` and `Retry-After` headers.
- Rate limits fail closed if Redis becomes temporarily unreachable, ensuring account security is never bypassed.
