# CreatorOS — Production Readiness & Operations Runbook

This document defines the production infrastructure topology, security configuration, monitoring, email authentication, and operational readiness sign-off for **Phase 14 (Production)**.

---

## 1. Production Architecture & Infrastructure Topology

```
                                    ┌───────────────────────┐
                                    │    Cloudflare CDN     │
                                    │  Edge SSL / DDoS WAF  │
                                    └──────────┬────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       │                                               │
             ┌─────────▼─────────┐                           ┌─────────▼─────────┐
             │ Next.js Web (BFF) │                           │   Go API Gateway  │
             │   SSR / SSG       │                           │  Modular Monolith │
             └─────────┬─────────┘                           └─────────┬─────────┘
                       │                                               │
                       ├───────────────────────┬───────────────────────┤
                       │                       │                       │
             ┌─────────▼─────────┐   ┌─────────▼─────────┐   ┌─────────▼─────────┐
             │ PostgreSQL 18 HA  │   │  Redis 8 Cluster  │   │ MinIO / S3 Store  │
             │ Read-Write + Repl │   │ Session / Limiter │   │ Object Storage    │
             └───────────────────┘   └───────────────────┘   └───────────────────┘
```

### 1.1 Components & Responsibilities
- **Edge CDN (Cloudflare Enterprise)**: Terminate TLS 1.3, enforce HTTP Strict Transport Security (HSTS), apply DDoS mitigation and Web Application Firewall (WAF) rules, and cache immutable static assets (`/_next/static/*`, `/images/*`).
- **Web Frontend (Next.js 16 App Router on Node.js 22 LTS)**: Multi-locale SSR/SSG across `id`, `en`, and `ms`. Acts as BFF proxy handling cookie-to-bearer authentication and double-submit CSRF enforcement.
- **Authoritative Backend (Go 1.27 API)**: Single modular monolith binary containing business domains: `auth`, `creator`, `marketplace`, `service`, `order`, `workflow`, `campaign`, `payment`, `communication`, and `admin`.
- **Database (PostgreSQL 18 HA with pgvector & uuid-ossp)**: Authoritative system of record. Automated WAL archiving and daily compressed backups with multi-region replication.
- **Cache & Rate Limiting (Redis 8)**: Distributed session registry, login attempt token buckets, network rate limiting, and real-time SSE pub/sub brokers.
- **Object Storage (S3 / MinIO)**: Encrypted S3-compatible bucket storing deliverable media assets (MP4, WEBM, PDF, ZIP) with immutable versioning and strict private signed URLs.

---

## 2. Production Environment & Secret Matrix

| Variable Name | Component | Required For | Security Standard |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Go API | PostgreSQL connection | TLS required (`sslmode=require`), rotated via secret manager |
| `REDIS_URL` | Go API | Redis cache & rate limiter | TLS with ACL auth (`rediss://`) |
| `APP_ENV` | API & Web | Runtime profile | Must be set to `production` |
| `API_PORT` | Go API | Network listening port | Default `8080` |
| `WEB_ORIGINS` | Go API | CORS origin whitelist | Explicit domains only (e.g. `https://creatoros.agency`) |
| `COOKIE_SECURE` | API & Web | Session cookie security | Must be `true` (enforces `Secure`, `HttpOnly`, `SameSite=Lax`) |
| `SESSION_SECRET` | Go API | Session token HMAC signing | 256-bit high-entropy secret |
| `CSRF_SECRET` | Go API & Web | CSRF HMAC generation | 256-bit high-entropy secret |
| `PAYMENT_PROVIDER` | Go API | Payment provider gateway | Set to `midtrans` (ID/MY) or `stripe` (Global/SG) |
| `MIDTRANS_SERVER_KEY` | Go API | Payment escrow charges | Midtrans Production Server Key |
| `MIDTRANS_CLIENT_KEY` | Web | Midtrans Snap modal | Midtrans Production Client Key |
| `STRIPE_SECRET_KEY` | Go API | Global card checkout | Stripe Live Secret Key |
| `STRIPE_WEBHOOK_SECRET` | Go API | Webhook signature verification | Stripe Live Webhook Signing Secret |
| `S3_BUCKET_NAME` | Go API | Media deliverables bucket | Private bucket with versioning enabled |
| `S3_ACCESS_KEY` | Go API | Object storage IAM user | Least-privilege IAM credentials |
| `S3_SECRET_KEY` | Go API | Object storage IAM user | Least-privilege IAM credentials |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Go API | Transactional notification email | SES / Resend SMTP credentials |
| `SENTRY_DSN` | API & Web | Production exception tracking | Isolated project DSN |

---

## 3. Email Authentication & Deliverability (SPF, DKIM, DMARC)

To ensure high inbox placement and prevent spoofing or phishing of CreatorOS notifications, the following DNS records are deployed:

### 3.1 SPF (Sender Policy Framework)
```txt
Name:  @
Type:  TXT
Value: v=spf1 include:amazonses.com include:_spf.resend.com -all
```

### 3.2 DKIM (DomainKeys Identified Mail)
```txt
Name:  s1._domainkey.creatoros.agency
Type:  CNAME
Value: s1.domainkey.amazonses.com
```

### 3.3 DMARC (Domain-based Message Authentication, Reporting & Conformance)
```txt
Name:  _dmarc.creatoros.agency
Type:  TXT
Value: v=DMARC1; p=reject; sp=reject; pct=100; rua=mailto:dmarc-reports@creatoros.agency; ruf=mailto:dmarc-forensics@creatoros.agency; aspf=s; adkim=s;
```

---

## 4. Monitoring, Health Checks & Observability

### 4.1 Health Endpoints
- **Liveness probe**: `GET /health/live` -> Returns HTTP 200 `{"status":"ok"}`.
- **Readiness probe**: `GET /health/ready` -> Verifies active connection pool to PostgreSQL, ping to Redis, and object storage connectivity. Returns HTTP 200 or HTTP 503.

### 4.2 Logging & Metrics
- Go API logs structured JSON using standard library `log/slog` to stdout, ingested by centralized logging (Datadog / Loki).
- Sentry error tracking integrated across client and server runtimes with release tags tracking git commit hashes.
- Prometheus scrape endpoint `/metrics` exports:
  - `http_requests_total{status, path, method}`
  - `http_request_duration_seconds{path}`
  - `postgres_pool_open_connections`
  - `redis_rate_limit_rejections_total`
  - `escrow_ledger_reconciliation_status`

---

## 5. Support Flow & Incident Management

### 5.1 Incident Severity Levels & SLAs
| Severity | Description | Target Response | Target Resolution |
| :--- | :--- | :--- | :--- |
| **P1 — Critical** | Platform outage, payment processing failure, ledger mismatch | < 15 minutes | < 2 hours |
| **P2 — Major** | Core feature degraded (e.g. deliverable uploads failing, delayed emails) | < 1 hour | < 6 hours |
| **P3 — Moderate** | Non-blocking bug, UI glitch, single user dispute | < 4 hours | < 24 hours |
| **P4 — Low** | Cosmetic adjustment, feature request, general inquiry | < 24 hours | Next release cycle |

### 5.2 Rollback Protocol
1. **Application Rollback**:
   - Container images are tagged with explicit semantic versions and commit SHAs (e.g. `creatoros-api:v1.0.0`).
   - If an unexpected regression is detected post-deployment, deployment manifests are rolled back to the prior known-good SHA within 2 minutes.
2. **Database Migration Safety**:
   - Every database migration includes an explicit, tested `.down.sql` rollback script.
   - Migrations are backwards-compatible (expand-contract pattern) to prevent breaking running instances during rolling deploys.
3. **Disaster Recovery**:
   - Automated database restoration scripts (`scripts/restore.ps1`, `scripts/restore.sh`) tested and validated against clean instances.

---

## 6. Launch Sign-Off Checklist

- [x] **Domain & HTTPS**: Valid SSL/TLS certificates with HSTS preload.
- [x] **CDN & Edge Security**: Cloudflare edge routing and WAF configured.
- [x] **Database Backups**: Automated dump & restore verified (`backups/creatoros_backup.dump`, 45 tables).
- [x] **Object Storage**: S3-compatible media upload pipeline with signed URLs and private permissions.
- [x] **Monitoring & Error Tracking**: Sentry and `/health/ready` endpoints operational.
- [x] **Rate Limiting**: Fail-closed Redis token bucket rate limiting on auth and mutations.
- [x] **Payment Integration**: Midtrans and Stripe webhook signatures and double-entry escrow verified.
- [x] **Email Authentication**: SPF, DKIM, and DMARC `p=reject` specifications established.
- [x] **Legal & Policies**: Localized Terms, Privacy, Creator Agreement, Client Agreement, and Cookie policies published.
- [x] **Support Flow**: Dedicated support portal (`/[locale]/support`) and dispute mediation playbooks active.
- [x] **Production Readiness Review**: Formally approved by Platform Engineering and Agency Operations.
