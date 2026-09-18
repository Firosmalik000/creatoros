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

## Cross-cutting boundaries

- API responses use `{ "data": ..., "meta": ... }` or a stable error envelope.
- Request IDs are returned as `X-Request-ID`.
- Health endpoints live outside authenticated business routes; readiness covers PostgreSQL and Redis.
- Configuration comes from environment variables and is validated at startup.
- OpenTelemetry hooks may be introduced without changing business modules.
