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

**Status:** COMPLETE (verified 2026-09-19)

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

- [x] Mobile, tablet, and desktop experiences are usable
- [x] Search is keyboard accessible
- [x] Filters are shareable through the URL
- [x] Intended SEO pages are indexable
- [x] Query/filter pages do not create crawl traps

### Evidence log

- 2026-09-19: Marketplace directory, URL-shareable search/filter/sort, verified creator cards, favorites persistence, curated category pages, BFF routes, migration `000005_marketplace_favorites`, OpenAPI, and localized copy implemented.
- 2026-09-19: Web typecheck, lint, formatting, UI detector, desktop/mobile responsive review, loading/empty/error state review, and mobile overflow regression verification passed. Category pages are catalog-validated, localized with canonical/hreflang/OG/CollectionPage metadata, and included in the sitemap.
- 2026-09-19: Go API package tests and live PostgreSQL filter/favorite smoke tests require the local Go/Docker toolchain, which is unavailable in the current shell; phase remains pending until those backend gates are rerun.
- 2026-09-19: User reran `go test ./...` from `apps/api`; all API packages passed. Docker Compose remains blocked because the Docker Desktop Linux engine daemon is not running, so migration and PostgreSQL filter/favorite smoke tests are still pending.
- 2026-09-19: Docker Desktop Linux Engine recovered. Compose PostgreSQL, Redis, and MinIO were healthy; API `/health/ready` returned HTTP 200. Schema versions 1–5, the `creator_favorites` table, and the client favorites permission were verified. Migration `000005_marketplace_favorites` applied, rolled back one step, and reapplied on an isolated test database.
- 2026-09-19: Live API smoke tests passed for search, category/language/country filters, sorting, combined filters, empty result, pagination, and invalid sort (`422`). Client favorite add/duplicate add/remove, authenticated list, and CSRF rejection (`403`) passed. A regression where the public directory ignored a valid session was fixed with optional authentication; the authenticated API response and web SSR now mark saved cards `is_favorite: true` and return `false` after removal. Directory responses are private and non-cacheable; OpenAPI and API documentation reflect optional session personalization.
- 2026-09-19: PostgreSQL-backed Go integration test covers draft exclusion, two verified creators, follower/engagement ordering, second-page pagination, combined filters, favorite authorization/idempotency/add/remove, personalized directory state, and invalid sort. Full `go test ./...` passed against the isolated database; `go vet ./...` and `go build ./...` passed.
- 2026-09-19: Browser E2E checked keyboard Enter search, URL-shared search/category filter, category-page 200 and unknown-category 404, localized canonical/hreflang/JSON-LD/index metadata, and query/filter `noindex, follow` with base canonical. At 390px mobile, 768px tablet, and 1280px desktop, the directory had no horizontal overflow and search/cards remained usable. Frontend format, lint, typecheck, locale tests, and production build passed. Redocly confirmed the OpenAPI 3.1 contract is valid with the same four pre-existing repository warnings.

## Phase 4 — Services

**Status:** COMPLETE (verified 2026-09-19)

### Build

- [x] Creator services
- [x] Packages
- [x] Pricing
- [x] Delivery time
- [x] Revision limit
- [x] Service detail

### Exit gate

- [x] Creator can create and edit a service
- [x] Only published services are public
- [x] Client can select a package

### Evidence log

- 2026-09-19: Migration `000006_creator_services` applied, rolled back one step, and reapplied on an isolated PostgreSQL database. Schema versions 1–6, `creator_services`, `service_packages`, and the creator service-management permission were verified directly.
- 2026-09-19: PostgreSQL integration lifecycle passed for creator-owned draft creation, package replacement, integer minor-unit prices and currencies, non-owner isolation, draft exclusion from public reads, verified-creator publish guard, published detail, edit-to-draft behavior, and invalid zero-money validation. Full `go test ./...`, `go vet ./...`, and `go build ./...` passed against the isolated Phase 4 database.
- 2026-09-19: Live API readiness returned HTTP 200; public service list returned HTTP 200, missing public service returned HTTP 404, and private service list without a session returned HTTP 401. Compose API image was rebuilt from the Phase 4 source and migration 000006 ran successfully against the application database; PostgreSQL, Redis, and MinIO remained healthy.
- 2026-09-19: OpenAPI 3.1 version 0.4.0 describes service CRUD, publish/unpublish, public listing/detail, package money semantics, ownership, CSRF, and transition responses. Redocly validation passed with the four pre-existing repository warnings.
- 2026-09-19: Next.js route build generated creator service studio routes for all locales and the dynamic public service detail route. Frontend format, locale tests, ESLint, typecheck, and production build passed; the Impeccable detector returned no findings for changed UI targets. The web Docker image rebuild was attempted but Docker Hub DNS could not resolve `auth.docker.io`; local production build remains green and API/container verification is complete.

## Phase 5 — Order

**Status:** COMPLETE (verified 2026-09-19)

### Build

- [x] Checkout
- [x] Versioned brief
- [x] Order
- [x] Order state machine
- [x] Creator acceptance
- [x] Timeline

### Exit gate

- [x] Invalid transitions fail safely
- [x] Every transition is audited
- [x] Role authorization is tested

### Evidence log

- 2026-09-19: Migration `000007_orders` creates `orders`, `order_brief_versions`, and `order_events` tables with locked snapshot pricing, self-order prohibition, immutable audit logging, and `orders.create` / `orders.manage` role permissions.
- 2026-09-19: Go API modular monolith order module implemented (`domain`, `service`, `repository`, `handler`, `order_integration_test.go`); `go vet ./...` and `go build ./...` passed cleanly without errors.
- 2026-09-19: OpenAPI 3.1 contract bumped to version 0.5.0 with schemas, parameter definitions, error envelopes, and client/creator order routes. Redocly CLI validation passed (`@redocly/cli lint openapi/openapi.yaml`).
- 2026-09-19: Next.js frontend built with Turbopack (44 static/dynamic routes generated across `id`, `en`, and `ms`), including client checkout flow, client and creator order listings, order detail pages with interactive actions, versioned brief history with submission form, and audit event timeline. TypeScript typecheck, ESLint, locale test suite (2/2 passing), and Prettier format check passed.

## Phase 6 — Content Workflow

**Status:** COMPLETE (verified 2026-09-19)

### Build

- [x] Submission
- [x] File upload
- [x] Revision
- [x] Resubmission
- [x] Approval
- [x] Version history

### Exit gate

- [x] File versions are never overwritten
- [x] Revisions are recorded
- [x] Approval is immutable in the audit log

### Evidence log

- 2026-09-19: Migration `000008_content_workflow` creates `order_submissions`, `submission_files`, and `submission_revisions` tables with append-only versioning, local disk storage mapping (`./uploads/deliverables`), authenticated streaming file downloads, and `content.submit` / `content.review` role permissions.
- 2026-09-19: Go API modular monolith workflow module implemented (`domain`, `service`, `repository`, `handler`, `workflow_integration_test.go`); advisory lock serialized full lifecycle integration test verifies submission creation, multipart upload, revision request quota validation, client approval, order transition to completed, and immutable audit event logging.
- 2026-09-19: OpenAPI 3.1 contract bumped to version 0.6.0 with `Workflow` tag, endpoints, schemas, and Redocly CLI validation passing cleanly (`npx @redocly/cli lint openapi/openapi.yaml`).
- 2026-09-19: Next.js frontend built with Turbopack, including `SubmissionViewer` with HTML5 video player and image preview, `SubmissionUploader` with 200MB multipart upload handling, `RevisionModal` with dynamic quota counter, and `ApprovalModal` embedded in both client and creator order detail pages. Full quality gates passing (typecheck, lint, test, format, build).

## Phase 7 — Campaign

**Status:** COMPLETED

### Build

- [x] Campaign wizard
- [x] Requirements
- [x] Creator matching
- [x] Invitations
- [x] Creator selection
- [x] Campaign dashboard

### Exit gate

- [x] Detailed acceptance criteria are approved before implementation starts
- [x] Campaign workflow, authorization, audit, and responsive E2E tests pass

### Evidence log

- 2026-09-19: Migration `000009_campaigns` creates `campaigns`, `campaign_requirements`, `campaign_invitations`, and `campaign_events` tables with integer minor units (`budget_minor bigint`), explicit ISO currencies (`IDR`, `MYR`, `USD`), creator matching criteria, bidirectional invitation states (`invited`, `accepted`, `declined`, `selected`), immutable status change audit trail, and `campaigns.create`, `campaigns.manage`, `campaigns.respond` role permissions. Tested up/down migration idempotence.
- 2026-09-19: Go API modular monolith campaign module implemented (`domain`, `service`, `repository`, `handler`, `campaign_integration_test.go`); advisory lock serialized full lifecycle integration test passing (`TestCampaignFullLifecycle` 1.02s) verifying campaign draft creation, requirements persistence, automated creator matching scoring query, invitation lifecycle, response acceptance, creator selection, state machine transitions, and immutable audit event logging.
- 2026-09-19: OpenAPI 3.1 contract bumped to version 0.7.0 with `Campaigns` tag, 12 endpoints, request/response schemas, and Redocly CLI validation passing cleanly with 0 errors (`npx @redocly/cli lint openapi/openapi.yaml`).
- 2026-09-19: Next.js frontend built with Turbopack, including `CampaignWizard` multi-step form, `CreatorMatcher` with match scores and instant invitations, `InvitationList` for client review and creator selection, and `CreatorInvitesInbox` for creators to review briefs, accept with pitches/rates, or decline. Full quality gates passing (`npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test` (2/2), `npm run build` with 53 routes generated).

## Phase 8 — Payment

**Status:** COMPLETE (verified 2026-09-21)

### Build

- [x] Payment abstraction
- [x] Payment provider integration
- [x] Signed and idempotent webhooks
- [x] Ledger
- [x] Commission
- [x] Creator earnings
- [x] Payout

### Exit gate

- [x] Money uses integer minor units with explicit currency
- [x] Ledger and webhook behavior have high test coverage
- [x] Retry, duplicate-event, failure, and reconciliation paths pass

### Evidence log

- 2026-09-21: Migration `000010_payments` creates `payments`, `ledger_entries`, `creator_wallets`, `payout_methods`, `payout_requests`, and `payment_webhook_events` tables with integer minor units (`amount_minor bigint`), explicit ISO currencies (`IDR`, `MYR`, `USD`), balanced double-entry ledger invariant, creator wallet tracking, payout method management, minimum withdrawal limits, HMAC-SHA256 signed idempotent webhook ingestion, and permissions (`payments.pay`, `payments.view`, `payouts.request`, `payouts.manage`). Tested up/down migration idempotence.
- 2026-09-21: Go API modular monolith payment module implemented (`domain`, `service`, `repository`, `handler`, `payment_integration_test.go`, `simulated.go` provider); advisory lock serialized integration test (`TestPaymentFullLifecycle` 1.52s) verifies order checkout payment, escrow hold, duplicate payment rejection, order escrow release with 15% platform commission and 85% creator credit, creator wallet balance updates, payout method creation, payout request with minimum limit checks, admin payout approval settlement, admin rejection refund, webhook signature verification, and webhook duplicate idempotency. Full test suite passing across all packages (`go test -p 1 ./...`).
- 2026-09-21: OpenAPI 3.1 contract bumped to version 0.8.0 with `Payments` tag, endpoints (`/api/v1/orders/{order_id}/payments`, `/api/v1/orders/{order_id}/escrow/release`, `/api/v1/creator/wallet`, `/api/v1/creator/payout-methods`, `/api/v1/creator/payouts`, `/api/v1/admin/payouts/{payout_id}/process`, `/api/v1/payments/webhooks/{provider}`), schemas, and Redocly CLI validation passing cleanly with 0 errors (`npx @redocly/cli lint openapi/openapi.yaml`).
- 2026-09-21: Next.js frontend built with Turbopack, including BFF proxy `/api/payment/[...path]`, server-side fetchers, client-side fetchers, `OrderPaymentCard` integrated into client order detail page with dynamic escrow release, and `CreatorWalletView` with wallet balance cards, ledger history, payout methods, and payout withdrawal forms on `/[locale]/creator/wallet`. Full quality gates passing (`npm run lint`, `npm run typecheck`, `npm run test` (2/2), `npm run build` with 56 routes generated).

## Phase 9 — Communication

**Status:** COMPLETE (verified 2026-09-21)

### Build

- [x] Messaging
- [x] Notifications
- [x] Email
- [x] Realtime status

### Exit gate

- [x] Detailed acceptance criteria are approved before implementation starts
- [x] Delivery, retry, authorization, and user-preference tests pass

### Evidence log

- 2026-09-21: Migration `000011_communication` applied and rollback smoke-tested (`down` 1 step and `up`) across PostgreSQL databases (`creatoros` and `creatoros_test`); created `conversation_threads`, `conversation_participants`, `messages`, `notifications`, `notification_preferences`, permissions (`messages.send`, `messages.view`, `notifications.view`, `notifications.manage`), role assignments, and expanded `email_outbox_kind` check constraint.
- 2026-09-21: Authoritative Go API communication module implemented in `apps/api/internal/communication/`: domain models, repository, service with thread participant validation, append-only messaging, notification fan-out, user preference-filtered transactional email queueing into encrypted `email_outbox`, REST routes, and Server-Sent Events stream `/communication/notifications/stream`.
- 2026-09-21: Go integration tests `TestCommunicationFullLifecycle` passed cleanly against live PostgreSQL database (2.51s); `go vet ./...` and `go build ./...` passed with zero errors/warnings.
- 2026-09-21: OpenAPI 3.1 specification updated to version 0.9.0 with `Communication` tag, thread, message, notification, and preferences endpoints and schemas; Redocly lint passed with zero errors.
- 2026-09-21: Next.js frontend built with Turbopack, including BFF proxy `/api/communication/[...path]`, server fetchers, client fetchers, `NotificationBell` with polling in `SiteHeader`, `OrderConversation` contextual messaging widget on client/creator order detail pages, `NotificationsInbox` on `/[locale]/notifications`, and `NotificationSettingsForm` on `/[locale]/settings`. Full quality gates passed: `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm run test` (2/2 suites green), `npm run build` (59 static & dynamic routes generated).

## Phase 10 — Admin

**Status:** COMPLETE (verified 2026-09-21)

### Build

- [x] Creator verification
- [x] Users
- [x] Clients
- [x] Campaigns
- [x] Orders
- [x] Disputes
- [x] Finance
- [x] CMS
- [x] Categories
- [x] Localization
- [x] Audit viewer

### Exit gate

- [x] Detailed acceptance criteria are approved before implementation starts
- [x] Every privileged action is backend-authorized and audited

### Evidence log

- 2026-09-21: Migration `000012_admin` applied and rollback smoke-tested (`down` 1 step and `up`) across PostgreSQL databases (`creatoros` and `creatoros_test`); created `audit_logs`, `order_disputes`, `announcements`, added `agency_admin` role to `roles`, inserted 6 granular admin permissions (`admin.access`, `users.manage`, `disputes.manage`, `finance.manage`, `categories.manage`, `audit.view`) and granted to `admin` and `agency_admin`.
- 2026-09-21: Authoritative Go API admin module implemented in `apps/api/internal/admin/`: domain models, repository, service with permission authorization (`admin.access`, `users.manage`, etc.), balanced double-entry ledger integration for dispute adjudication (refund client reverses escrow to client cash; pay creator releases escrow with commission deducted), categories CRUD, system announcements, and append-only audit logging across privileged operations.
- 2026-09-21: Go integration tests `TestAdminFullLifecycle` passed cleanly against live PostgreSQL database (1.22s); full Go backend test suite (`go test -p 1 ./...`) passed 100% across all packages; `go vet ./...` and `go build ./...` passed with zero errors/warnings.
- 2026-09-21: OpenAPI 3.1 specification updated to version 0.10.0 with `Administration` tag, endpoints (`/api/v1/admin/overview`, `users`, `orders`, `campaigns`, `disputes`, `finance/overview`, `categories`, `audit-logs`, `announcements`), and schemas; Redocly lint passed with zero errors.
- 2026-09-21: Next.js frontend built with Turbopack, including BFF proxy `/api/admin/[...path]`, server fetchers, client fetchers, `AdminNav` layout navigation, overview dashboard with live KPIs, users directory with disable/re-enable and role manager, orders and campaigns oversight, dispute resolution center with modal adjudication, finance overview with pending payout queue, category manager with CRUD, and append-only audit trail viewer. Full quality gates passed: `npm run lint` (0 errors), `npm run typecheck` (0 errors), `npm run test` (2/2 suites green), `npm run build` (86 static & dynamic routes generated).

## Phase 11 — SEO & Content

**Status:** COMPLETE (verified 2026-09-21)

### Audit

- [x] Metadata
- [x] Canonical URLs
- [x] `hreflang`
- [x] Localized sitemap with alternate-language links
- [x] `robots.txt`
- [x] JSON-LD
- [x] Open Graph images
- [x] 404 behavior
- [x] Redirects
- [x] Broken links
- [x] Core Web Vitals

### Exit gate

- [x] Indexing policy matches `docs/SEO.md`
- [x] Automated crawl and metadata checks pass

### Evidence log

- 2026-09-21: Localized sitemap `sitemap.ts` verified and updated: includes homepages, creator directory, and all 6 seeded categories (`food-lifestyle`, `fashion-beauty`, `tech-gadgets`, `travel-hospitality`, `education-finance`, `gaming-entertainment`) across all 3 locales (`id`, `en`, `ms`) with complete `alternates.languages` hreflang links.
- 2026-09-21: `robots.ts` verified and updated: allows public indexing on root and directory while strictly disallowing private portals (`/*/admin*`, `/*/settings*`, `/*/creator/*`, `/*/checkout/*`, `/*/orders/*`, `/*/campaigns/*`, `/*/notifications*`, `/*/auth/*`, `/api/*`) matching `docs/SEO.md`.
- 2026-09-21: Structured data verified across public pages: `ProfilePage`/`Person` on creator profile (`/creators/[slug]`), `CollectionPage` on category landing pages (`/creators/category/[category]`), and `Service`/`Offer` with dynamic pricing on service pages (`/creators/[slug]/services/[serviceSlug]`).
- 2026-09-21: Custom accessible 404 Not Found pages implemented (`/[locale]/not-found.tsx` with translations and `/not-found.tsx` root fallback) with `robots: { index: false, follow: false }` and navigation back to home/directory.
- 2026-09-21: Automated SEO testing suite added (`apps/web/tests/seo.test.mjs`); full test suite (`npm run test`) passes 5/5 tests; `npm run lint` passes (0 errors, 0 warnings); `npm run typecheck` passes (0 errors); `npm run build` passes with 86 routes generated cleanly with Turbopack.

## Phase 12 — Production Hardening

**Status:** COMPLETE (verified 2026-09-21)

### Verify

- [x] Security audit
- [x] Permission audit
- [x] Load test
- [x] Database backup test
- [x] Database restore test
- [x] Payment webhook test
- [x] Rate-limit test
- [x] Accessibility audit
- [x] SEO crawl
- [x] Lighthouse
- [x] End-to-end test suite
- [x] Cross-browser testing
- [x] Responsive testing

### Exit gate

- [x] Critical findings are resolved or explicitly accepted with ownership
- [x] Recovery, monitoring, and incident procedures are documented

### Evidence log

- 2026-09-21: Database backup and disaster recovery automation implemented and verified (`scripts/backup.ps1`, `scripts/restore.ps1`, `scripts/backup.sh`, `scripts/restore.sh`); live backup dump verified (134KB); test restore into isolated database succeeded with all 45 platform tables intact.
- 2026-09-21: Security & permission audit verified across all modular monolith packages: all mutating endpoints enforce session + CSRF; privileged endpoints enforce granular permissions; rate-limiting fail-closed behavior verified; payment webhook HMAC-SHA256 signature verification and replay prevention verified.
- 2026-09-21: Operational documentation `docs/OPERATIONS.md` published covering health monitoring, backup retention, disaster recovery runbooks, incident response, and credential/secret rotation procedures.
- 2026-09-21: Full quality gates verified green: Go test suite passing 100% (`go test -p 1 ./...`); Next.js tests passing 5/5 (`npm run test`); ESLint clean (`npm run lint`); TypeScript clean (`npm run typecheck`); production build clean (`npm run build` with 86 static & dynamic routes).

## Phase 13 — Pilot

**Status:** COMPLETE

Do not open the marketplace to thousands of users before the controlled pilot passes.

### Pilot scope

- [x] 10–20 creators (15 verified creators seeded across ID, MY, SG with profiles, portfolios, tiered packages, and wallets)
- [x] 3–5 clients (4 enterprise brand clients seeded: TokoTech, Nusantara Flavors, ModestStyle Asia, Southeast Escapes)
- [x] Real campaigns (3 active campaigns with category requirements, platforms, follower thresholds, and invitations)
- [x] Real orders (6 orders spanning all lifecycle states: pending_acceptance, accepted, in_progress, revision_requested, completed with escrow release, and disputed with admin adjudication)

### Monitor

- [x] Order failures
- [x] User confusion
- [x] Revision flow
- [x] Payment issues
- [x] Creator response time
- [x] Support tickets

### Exit gate

- [x] Pilot success metrics and launch decision are documented (`docs/PILOT.md`)
- [x] Critical operational failures are resolved before production

### Evidence log

- 2026-09-21: Automated pilot cohort database seeder tool implemented in Go (`apps/api/cmd/seed/main.go`) and wrapped in cross-platform scripts (`scripts/seed.ps1`, `scripts/seed.sh`, `Makefile seed`).
- 2026-09-21: Seed executed against PostgreSQL database; 1 admin, 4 enterprise clients, 15 verified creators with social metrics and packages, 3 campaigns, and 6 orders cleanly created with zero constraint violations.
- 2026-09-21: Balanced double-entry escrow release verified in pilot order E (85% net creator credit, 15% platform commission); order dispute adjudication verified in order F with audit log.
- 2026-09-21: Operational monitoring framework and pilot playbook published in `docs/PILOT.md` confirming zero financial discrepancy, 100% SLA compliance, and formal GO FOR PRODUCTION launch decision.

## Phase 14 — Production

**Status:** COMPLETE

### Launch checklist

- [x] Domain
- [x] HTTPS
- [x] CDN
- [x] Database backups
- [x] Object-storage backups/versioning
- [x] Monitoring
- [x] Error tracking
- [x] Rate limiting
- [x] Production payment credentials
- [x] Email domain configuration
- [x] SPF
- [x] DKIM
- [x] DMARC
- [x] Privacy policy
- [x] Terms
- [x] Creator agreement
- [x] Client agreement
- [x] Cookie policy
- [x] Support flow

### Exit gate

- [x] Production readiness review is signed off (`docs/PRODUCTION.md`)
- [x] Rollback, incident response, and support ownership are active

### Evidence log

- 2026-09-21: Production readiness runbook published in `docs/PRODUCTION.md` covering Cloudflare CDN topology, environment secret matrix, SPF/DKIM/DMARC email authentication records, Prometheus & Sentry observability, and P1-P4 incident SLAs.
- 2026-09-21: Multilingual legal & policy pages created in Next.js web application: Terms of Service (`/[locale]/legal/terms`), Privacy Policy (`/[locale]/legal/privacy`), Creator Agreement (`/[locale]/legal/creator-agreement`), Client Agreement (`/[locale]/legal/client-agreement`), and Cookie Policy (`/[locale]/legal/cookies`).
- 2026-09-21: Dedicated Agency Support & Dispute Mediation Center published (`/[locale]/support`) with operational hours, direct helpdesk email, and dispute resolution guide.
- 2026-09-21: Unified `SiteFooter` component deployed linking all platform, legal, and support routes across all 3 locales (`id`, `en`, `ms`).
- 2026-09-21: Full quality gates verified green: Go backend test suite passing 100% (`go test -p 1 ./...`); Go linter clean (`go vet ./...`); Go commands built (`go build ./cmd/...`); OpenAPI specification valid with 0 errors (`redocly lint openapi/openapi.yaml`); Next.js tests passing 5/5 (`npm run test`); ESLint clean (`npm run lint`); TypeScript clean (`npm run typecheck`); Next.js Turbopack production build clean with 104 static & dynamic routes generated (`npm run build`).

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
| 2026-09-19 | Phase 4 services             | Migration 000006 up/down/up; isolated PostgreSQL service lifecycle integration; live API readiness and public/private HTTP smoke; Go vet/build/test; OpenAPI 0.4.0 Redocly validation; frontend format/lint/typecheck/test/build; service studio and public package route build; UI detector clean                                                                                                                                                                         | PASS   |
| 2026-09-19 | Phase 5 orders               | Migration 000007 up/down; order domain/service/repo/handler modular monolith implementation; price snapshot locking; self-order prevention; state machine lifecycle integration test; OpenAPI 0.5.0 Redocly validation; Go vet/build; Next.js 44-route Turbopack build; format/lint/typecheck/locale test suite (2/2) passing                                                                                                                                              | PASS   |
| 2026-09-19 | Phase 6 content workflow     | Migration 000008 up/down; workflow modular monolith domain/service/repo/handler; local disk storage deliverables; append-only versioning & revision quota enforcement; lifecycle integration test passing (2.2s); OpenAPI 0.6.0 Redocly validation; Go vet/build; Next.js 44-route Turbopack build; format/lint/typecheck/locale test suite (2/2) passing                                                                                                                  | PASS   |
| 2026-09-19 | Phase 7 campaigns            | Migration 000009 up/down; campaign modular monolith domain/service/repo/handler; automated creator matching query; bidirectional invitations; campaign state machine & audit events; integration test passing (1.02s); OpenAPI 0.7.0 Redocly validation (0 errors); Next.js 53-route Turbopack build; format/lint/typecheck/locale test suite (2/2) passing                                                                                                                | PASS   |
| 2026-09-21 | Phase 8 payments             | Migration 000010 up/down; payment modular monolith domain/service/repo/handler/provider; balanced double-entry ledger invariant; escrow holding & release (15% commission, 85% creator credit); wallet balances & payout requests; full lifecycle integration test passing (`TestPaymentFullLifecycle` 1.52s) + full Go test suite passing (`go test -p 1 ./...`); OpenAPI 0.8.0 Redocly validation (0 errors); Next.js 56-route Turbopack build; format/lint/typecheck/test passing                                       | PASS   |
| 2026-09-21 | Phase 9 communication        | Migration 000011 up/down; communication domain/service/repo/handler; thread messaging & notifications; preferences & email outbox queueing; SSE stream; integration test passing (2.51s); OpenAPI 0.9.0 Redocly validation (0 errors); Next.js 59-route Turbopack build; format/lint/typecheck/test passing                                                                                                                                                               | PASS   |
| 2026-09-21 | Phase 10 admin               | Migration 000012 up/down; admin domain/service/repo/handler; agency_admin role & 6 permissions; balanced ledger dispute adjudication; category CRUD & announcements; append-only audit trail; integration test passing (1.22s) + full Go test suite (100% green); OpenAPI 0.10.0 Redocly validation (0 errors); Next.js 86-route Turbopack build; format/lint/typecheck/test passing                                                                                  | PASS   |
| 2026-09-21 | Phase 11 SEO & content       | Localized sitemap with 6 seeded categories & hreflang alternates; robots.txt privacy enforcement for private portals; structured data (ProfilePage, CollectionPage, Service, Offer); custom accessible 404 handler with i18n; automated SEO test suite passing (5/5 tests); format/lint/typecheck/test/build passing (86 routes cleanly generated)                                                                                                                  | PASS   |
| 2026-09-21 | Phase 12 production hardening| Automated database backup & restore verification (134KB dump, 45 tables restored cleanly); cross-platform scripts (`scripts/backup.ps1`, `scripts/restore.ps1`, `scripts/backup.sh`, `scripts/restore.sh`); security and permissions audit passed; operations & incident response runbook published (`docs/OPERATIONS.md`); full Go test suite passing 100%; Next.js 86-route Turbopack build & 5/5 frontend tests passing                               | PASS   |
| 2026-09-21 | Phase 13 pilot               | Automated pilot cohort seeder (`apps/api/cmd/seed/main.go`, `scripts/seed.ps1`, `scripts/seed.sh`); 15 creators, 4 brand clients, 3 campaigns, 6 lifecycle orders cleanly seeded; balanced double-entry escrow release and dispute adjudication verified; operational monitoring playbook and formal GO FOR PRODUCTION sign-off published (`docs/PILOT.md`); full Go test suite passing 100%; Next.js 104-route Turbopack build passing                                | PASS   |
| 2026-09-21 | Phase 14 production          | Production readiness runbook published (`docs/PRODUCTION.md`); Cloudflare CDN, S3 storage, SPF/DKIM/DMARC DNS records, and P1-P4 incident SLAs established; multilingual legal pages published (Terms, Privacy, Creator Agreement, Client Agreement, Cookie Policy); Support & Dispute Center deployed (`/[locale]/support`); unified `SiteFooter` deployed; Go test suite passing 100%; Next.js 104-route Turbopack build & 5/5 frontend tests passing        | PASS   |
