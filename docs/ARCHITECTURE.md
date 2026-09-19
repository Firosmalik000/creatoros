# Architecture

## System shape

CreatorOS is a modular monolith. The Next.js application owns rendering, navigation, accessibility, localization, and client/server UI state. The Go API owns authentication, authorization, workflow rules, pricing, payments, audit history, and persistence.

```text
Browser -> Next.js web -> REST /api/v1 -> Go modules -> PostgreSQL
                                      |              -> Redis
                                      +--------------> S3-compatible storage
```

## Module convention

Each business module may contain `domain`, `service`, `repository`, `handler`, and `dto` packages. Dependencies point inward: handlers call services, services use domain interfaces, and infrastructure implements repositories. HTTP handlers do not contain authoritative business logic.

The Phase 2 `creator` module follows this boundary. The auth handler exposes only shared session and CSRF middleware plus the authenticated session context; creator authorization and verification transitions remain in the creator service. The repository performs aggregate replacement and status/audit writes transactionally. Next.js owns the creator/admin operational surfaces and the server-rendered public profile, but never decides whether a creator is public.

The Phase 4 `service` module owns creator service offers, packages, pricing, and publish/unpublish rules. Package replacement is atomic. The module checks ownership and the creator-management permission for private operations; public queries independently require an active, verified creator and a published service. Next.js renders the operational studio and public package selection but does not decide publication eligibility or calculate stored money.

## Cross-cutting boundaries

- API responses use `{ "data": ..., "meta": ... }` or a stable error envelope.
- Request IDs are returned as `X-Request-ID`.
- Health endpoints live outside authenticated business routes; readiness covers PostgreSQL and Redis.
- Configuration comes from environment variables and is validated at startup.
- OpenTelemetry hooks may be introduced without changing business modules.
