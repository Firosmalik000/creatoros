# Delivery Roadmap

Dokumen ini menyalin urutan delivery dari **Master Blueprint v1.0** ke dalam repository. Checklist adalah sumber tracking resmi; item hanya boleh ditandai selesai setelah implementasi dan bukti verifikasinya tersedia.

## Status legend

- `[ ]` planned atau belum terverifikasi
- `[~]` in progress (dipakai pada status fase, bukan checklist)
- `[x]` implemented dan terverifikasi
- `BLOCKED` membutuhkan prerequisite atau keputusan eksternal

## Phase 0 — Foundation

**Status:** COMPLETE (verified 2026-09-15)

Tidak membangun fitur marketplace sebelum seluruh exit gate Phase 0 lulus.

### Repository deliverables

- [x] Repository dan monorepo layout
- [x] Next.js web application
- [x] Go modular-monolith API foundation
- [x] PostgreSQL service configuration
- [x] Redis service configuration
- [x] S3-compatible object storage configuration
- [x] Docker and Compose definitions
- [x] CI workflow
- [x] Environment configuration example
- [x] OpenAPI foundation
- [x] `AGENTS.md` working contract
- [x] Design tokens and visual direction
- [x] i18n foundation for `id`, `en`, and `ms`

### Local workstation readiness

- [x] Git available
- [x] npm 11 available
- [x] Compatible Node.js runtime available (25.9.0 locally; Node.js 24 pinned in CI and containers)
- [x] Go 1.27+ installed and available on User `PATH` (1.27.1)
- [x] Docker Desktop with Compose installed and running (Desktop 4.91.0, Engine 29.8.0, Compose 5.5.1)
- [x] Local `.env` created from `.env.example`

### Exit gate

- [x] Web format check, lint, typecheck, tests, and production build pass
- [x] `go vet ./...` passes
- [x] `go test -race ./...` passes
- [x] Go API production build passes
- [x] Docker Compose stack builds and becomes healthy
- [x] Web can reach the Go API health endpoint through local configuration
- [x] PostgreSQL, Redis, and object storage connectivity verified
- [x] Phase 0 verification evidence recorded in this document

## Phase 1 — Auth & User

**Status:** PLANNED

### Build

- [ ] Register
- [ ] Login
- [ ] Logout
- [ ] Email/account verification
- [ ] Forgot/reset password
- [ ] Roles
- [ ] Permissions
- [ ] User settings
- [ ] Language selection and persistence

### Exit gate

- [ ] Client can register and log in
- [ ] Creator can register and log in
- [ ] Unauthorized routes are protected by the backend
- [ ] Language persistence works
- [ ] End-to-end authentication tests pass

## Phase 2 — Creator Foundation

**Status:** PLANNED

### Build

- [ ] Creator onboarding
- [ ] Creator profile
- [ ] Social platforms
- [ ] Categories
- [ ] Portfolio
- [ ] Creator verification
- [ ] Public creator profile

### Exit gate

- [ ] Admin can approve a creator
- [ ] Verified creators appear publicly
- [ ] Non-verified creators never appear publicly
- [ ] Public profile SEO metadata is valid

## Phase 3 — Marketplace

**Status:** PLANNED

### Build

- [ ] Creator directory
- [ ] Search
- [ ] Filter
- [ ] Sort
- [ ] Favorites
- [ ] Category pages
- [ ] Creator cards
- [ ] Creator detail

### Exit gate

- [ ] Mobile, tablet, and desktop experiences are usable
- [ ] Search is keyboard accessible
- [ ] Filters are shareable through the URL
- [ ] Intended SEO pages are indexable
- [ ] Query/filter pages do not create crawl traps

## Phase 4 — Services

**Status:** PLANNED

### Build

- [ ] Creator services
- [ ] Packages
- [ ] Pricing
- [ ] Delivery time
- [ ] Revision limit
- [ ] Service detail

### Exit gate

- [ ] Creator can create and edit a service
- [ ] Only published services are public
- [ ] Client can select a package

## Phase 5 — Order

**Status:** PLANNED

### Build

- [ ] Checkout
- [ ] Versioned brief
- [ ] Order
- [ ] Order state machine
- [ ] Creator acceptance
- [ ] Timeline

### Exit gate

- [ ] Invalid transitions fail safely
- [ ] Every transition is audited
- [ ] Role authorization is tested

## Phase 6 — Content Workflow

**Status:** PLANNED

### Build

- [ ] Submission
- [ ] File upload
- [ ] Revision
- [ ] Resubmission
- [ ] Approval
- [ ] Version history

### Exit gate

- [ ] File versions are never overwritten
- [ ] Revisions are recorded
- [ ] Approval is immutable in the audit log

## Phase 7 — Campaign

**Status:** PLANNED

### Build

- [ ] Campaign wizard
- [ ] Requirements
- [ ] Creator matching
- [ ] Invitations
- [ ] Creator selection
- [ ] Campaign dashboard

### Exit gate

- [ ] Detailed acceptance criteria are approved before implementation starts
- [ ] Campaign workflow, authorization, audit, and responsive E2E tests pass

## Phase 8 — Payment

**Status:** PLANNED

### Build

- [ ] Payment abstraction
- [ ] Payment provider integration
- [ ] Signed and idempotent webhooks
- [ ] Ledger
- [ ] Commission
- [ ] Creator earnings
- [ ] Payout

### Exit gate

- [ ] Money uses integer minor units with explicit currency
- [ ] Ledger and webhook behavior have high test coverage
- [ ] Retry, duplicate-event, failure, and reconciliation paths pass

## Phase 9 — Communication

**Status:** PLANNED

### Build

- [ ] Messaging
- [ ] Notifications
- [ ] Email
- [ ] Realtime status

### Exit gate

- [ ] Detailed acceptance criteria are approved before implementation starts
- [ ] Delivery, retry, authorization, and user-preference tests pass

## Phase 10 — Admin

**Status:** PLANNED

### Build

- [ ] Creator verification
- [ ] Users
- [ ] Clients
- [ ] Campaigns
- [ ] Orders
- [ ] Disputes
- [ ] Finance
- [ ] CMS
- [ ] Categories
- [ ] Localization
- [ ] Audit viewer

### Exit gate

- [ ] Detailed acceptance criteria are approved before implementation starts
- [ ] Every privileged action is backend-authorized and audited

## Phase 11 — SEO & Content

**Status:** PLANNED

### Audit

- [ ] Metadata
- [ ] Canonical URLs
- [ ] `hreflang`
- [ ] Localized sitemap with alternate-language links
- [ ] `robots.txt`
- [ ] JSON-LD
- [ ] Open Graph images
- [ ] 404 behavior
- [ ] Redirects
- [ ] Broken links
- [ ] Core Web Vitals

### Exit gate

- [ ] Indexing policy matches `docs/SEO.md`
- [ ] Automated crawl and metadata checks pass

## Phase 12 — Production Hardening

**Status:** PLANNED

### Verify

- [ ] Security audit
- [ ] Permission audit
- [ ] Load test
- [ ] Database backup test
- [ ] Database restore test
- [ ] Payment webhook test
- [ ] Rate-limit test
- [ ] Accessibility audit
- [ ] SEO crawl
- [ ] Lighthouse
- [ ] End-to-end test suite
- [ ] Cross-browser testing
- [ ] Responsive testing

### Exit gate

- [ ] Critical findings are resolved or explicitly accepted with ownership
- [ ] Recovery, monitoring, and incident procedures are documented

## Phase 13 — Pilot

**Status:** PLANNED

Do not open the marketplace to thousands of users before the controlled pilot passes.

### Pilot scope

- [ ] 10–20 creators
- [ ] 3–5 clients
- [ ] Real campaigns
- [ ] Real orders

### Monitor

- [ ] Order failures
- [ ] User confusion
- [ ] Revision flow
- [ ] Payment issues
- [ ] Creator response time
- [ ] Support tickets

### Exit gate

- [ ] Pilot success metrics and launch decision are documented
- [ ] Critical operational failures are resolved before production

## Phase 14 — Production

**Status:** PLANNED

### Launch checklist

- [ ] Domain
- [ ] HTTPS
- [ ] CDN
- [ ] Database backups
- [ ] Object-storage backups/versioning
- [ ] Monitoring
- [ ] Error tracking
- [ ] Rate limiting
- [ ] Production payment credentials
- [ ] Email domain configuration
- [ ] SPF
- [ ] DKIM
- [ ] DMARC
- [ ] Privacy policy
- [ ] Terms
- [ ] Creator agreement
- [ ] Client agreement
- [ ] Cookie policy
- [ ] Support flow

### Exit gate

- [ ] Production readiness review is signed off
- [ ] Rollback, incident response, and support ownership are active

## Evidence log

Add dated evidence here whenever a phase is completed.

| Date       | Phase                        | Evidence                                                                                                                                                                                   | Result |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 2026-09-15 | Phase 0 web foundation       | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`; localized browser routes and public SEO endpoints checked                                    | PASS   |
| 2026-09-15 | Phase 0 Go toolchain         | Go 1.27.1 installed on User `PATH`; `go vet ./...`, `go test ./...`, and `go build -buildvcs=false -o ./bin/creatoros-api.exe ./cmd/server`                                                | PASS   |
| 2026-09-15 | Phase 0 race detection       | `go test -race ./...` in ephemeral `golang:1.27-alpine` Linux container with build toolchain                                                                                               | PASS   |
| 2026-09-15 | Phase 0 Docker stack         | Docker Desktop 4.91.0 / Engine 29.8.0 / Compose 5.5.1; `docker compose up --build -d`; PostgreSQL, Redis, and MinIO healthy; API live/ready, web `/id`, and MinIO health returned HTTP 200 | PASS   |
| 2026-09-15 | Phase 0 service connectivity | Web container fetched Go API `/health/ready` through the configured internal Docker host and received HTTP 200                                                                             | PASS   |
