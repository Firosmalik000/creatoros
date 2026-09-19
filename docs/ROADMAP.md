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

**Status:** COMPLETE (verified 2026-09-18)

### Build

- [x] Register
- [x] Login
- [x] Logout
- [x] Email/account verification
- [x] Forgot/reset password
- [x] Roles
- [x] Permissions
- [x] User settings
- [x] Language selection and persistence

### Exit gate

- [x] Client can register and log in
- [x] Creator can register and log in
- [x] Unauthorized routes are protected by the backend
- [x] Language persistence works
- [x] End-to-end authentication tests pass

## Phase 2 — Creator Foundation

**Status:** COMPLETE (verified 2026-09-19)

### Build

- [x] Creator onboarding
- [x] Creator profile
- [x] Social platforms
- [x] Categories
- [x] Portfolio
- [x] Creator verification
- [x] Public creator profile

### Exit gate

- [x] Admin can approve a creator
- [x] Verified creators appear publicly
- [x] Non-verified creators never appear publicly
- [x] Public profile SEO metadata is valid

### Evidence log

- 2026-09-19: Migration `000004_creator_foundation` applied and down/up rollback smoke test passed against PostgreSQL; seeded platform/category catalog verified.
- 2026-09-19: Go creator integration tests passed for verification visibility and atomic invalid-reference rollback; auth, creator, config, HTTP, notification, and rate-limit package tests passed; `go vet ./...`, API build, and named race-container package runs passed.
- 2026-09-19: Browser E2E passed with local creator/admin accounts: onboarding draft saved, complete submission entered the review queue, admin approval published the profile, and `/id/creators/naufal-tech` rendered the verified public profile with portfolio/social evidence. The non-verified visibility rule is covered by the creator integration test.
- 2026-09-19: Public profile metadata implementation verified in page source: localized title/description, canonical, hreflang, Open Graph profile fields, `ProfilePage`/`Person` JSON-LD, robots index, responsive layout, and accessible skip/navigation labels.
- 2026-09-19: OpenAPI 0.3.0 lint passed with only the four pre-existing repository warnings; Docker Compose API/web rebuild and health checks passed. Frontend locale tests, formatting, lint, typecheck, production build, and UI detector review were previously green; country selection regression was fixed and rechecked through the browser flow.

## Phase 3 — Marketplace

**Status:** IMPLEMENTED — verification pending

### Build

- [x] Creator directory
- [x] Search
- [x] Filter
- [x] Sort
- [x] Favorites
- [x] Category pages
- [x] Creator cards
- [x] Creator detail

### Exit gate

- [ ] Mobile, tablet, and desktop experiences are usable
- [ ] Search is keyboard accessible
- [ ] Filters are shareable through the URL
- [ ] Intended SEO pages are indexable
- [ ] Query/filter pages do not create crawl traps

### Evidence log

- 2026-09-19: Marketplace directory, URL-shareable search/filter/sort, verified creator cards, favorites persistence, curated category pages, BFF routes, migration `000005_marketplace_favorites`, OpenAPI, and localized copy implemented.
- 2026-09-19: Web typecheck, lint, formatting, UI detector, desktop/mobile responsive review, loading/empty/error state review, and mobile overflow regression verification passed. Category pages are catalog-validated, localized with canonical/hreflang/OG/CollectionPage metadata, and included in the sitemap.
- 2026-09-19: Go API package tests and live PostgreSQL filter/favorite smoke tests require the local Go/Docker toolchain, which is unavailable in the current shell; phase remains pending until those backend gates are rerun.
- 2026-09-19: User reran `go test ./...` from `apps/api`; all API packages passed. Docker Compose remains blocked because the Docker Desktop Linux engine daemon is not running, so migration and PostgreSQL filter/favorite smoke tests are still pending.

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

| Date       | Phase                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Result |
| ---------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 2026-09-15 | Phase 0 web foundation       | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`; localized browser routes and public SEO endpoints checked                                                                                                                                                                                                                                                                                                                    | PASS   |
| 2026-09-15 | Phase 0 Go toolchain         | Go 1.27.1 installed on User `PATH`; `go vet ./...`, `go test ./...`, and `go build -buildvcs=false -o ./bin/creatoros-api.exe ./cmd/server`                                                                                                                                                                                                                                                                                                                                | PASS   |
| 2026-09-15 | Phase 0 race detection       | `go test -race ./...` in ephemeral `golang:1.27-alpine` Linux container with build toolchain                                                                                                                                                                                                                                                                                                                                                                               | PASS   |
| 2026-09-15 | Phase 0 Docker stack         | Docker Desktop 4.91.0 / Engine 29.8.0 / Compose 5.5.1; `docker compose up --build -d`; PostgreSQL, Redis, and MinIO healthy; API live/ready, web `/id`, and MinIO health returned HTTP 200                                                                                                                                                                                                                                                                                 | PASS   |
| 2026-09-15 | Phase 0 service connectivity | Web container fetched Go API `/health/ready` through the configured internal Docker host and received HTTP 200                                                                                                                                                                                                                                                                                                                                                             | PASS   |
| 2026-09-18 | Phase 1 auth lifecycle       | Integration lifecycle covers client/creator registration, one-time verification, login, protected `me`, CSRF rejection, locale persistence, forgot/reset password, session revocation, and logout; `go test ./...` passed against isolated `creatoros_test`                                                                                                                                                                                                                | PASS   |
| 2026-09-18 | Phase 1 race detection       | `go test -race ./...` passed in the official `golang:1.27` Linux container against isolated `creatoros_test`                                                                                                                                                                                                                                                                                                                                                               | PASS   |
| 2026-09-18 | Phase 1 migrations           | Migration `000002_auth_and_users` applied, rolled back one step, and reapplied successfully on isolated `creatoros_test`; Compose migration job also exited successfully                                                                                                                                                                                                                                                                                                   | PASS   |
| 2026-09-18 | Phase 1 web and UX           | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`; 29 localized routes built; register-to-logout browser flow and desktop/mobile review passed; Impeccable finish review approved                                                                                                                                                                                                                                           | PASS   |
| 2026-09-18 | Phase 1 API contract         | Redocly validated `openapi/openapi.yaml`; explicit public/default and cookie-auth security contracts documented                                                                                                                                                                                                                                                                                                                                                            | PASS   |
| 2026-09-18 | Phase 1 local stack          | Docker Compose rebuilt after local Docker recovery; PostgreSQL, Redis, and MinIO healthy; API `/health/ready` and web `/id/auth/register` returned HTTP 200                                                                                                                                                                                                                                                                                                                | PASS   |
| 2026-09-18 | Phase 1 auth hardening       | Migration `000003_auth_hardening` apply/down/up; disabled-account verification regression; AES-256-GCM outbox enqueue/delivery/expiry cleanup; Redis network/account rate limits with `429`/`Retry-After`; production secure-cookie/config fail-closed tests; `go vet ./...`, PostgreSQL+Redis `go test ./...`, Linux `go test -race ./...`, API build, Redocly validation, web format/lint/typecheck/test/build, Compose rebuild, and PostgreSQL+Redis readiness HTTP 200 | PASS   |
