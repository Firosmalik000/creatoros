# API

The REST API is served under `/api/v1`. `openapi/openapi.yaml` is the contract authority.

## Envelope

Successful business responses use `data` and optional `meta`. Errors use a stable machine-readable code, a developer-facing message, and optional details. Frontends localize by code rather than displaying backend strings directly.

## Implemented endpoints

- `GET /health/live`: process liveness.
- `GET /health/ready`: API and PostgreSQL readiness.
- `POST /api/v1/auth/register`: register a `client` or `creator`.
- `POST /api/v1/auth/verify-email`: consume a one-time verification token.
- `POST /api/v1/auth/login`: create a cookie-backed session.
- `GET /api/v1/auth/me`: return the authenticated user, roles, and permissions.
- `POST /api/v1/auth/logout`: revoke the current session; requires CSRF validation.
- `POST /api/v1/auth/forgot-password`: issue a reset without revealing account existence.
- `POST /api/v1/auth/reset-password`: update the password and revoke existing sessions.
- `PATCH /api/v1/users/me/settings`: persist the authenticated user's locale; requires CSRF validation.

Authentication uses the HttpOnly `creatoros_session` cookie. State-changing authenticated requests must also send `X-CSRF-Token` matching the session-bound `creatoros_csrf` cookie. Raw session and one-time tokens are never stored in PostgreSQL; only SHA-256 hashes are persisted.

Email delivery is intentionally deferred to Phase 9. Local and test environments expose verification and reset tokens in response `meta` so the complete identity workflow can be exercised without a fake mail provider. Production responses never expose those tokens.

Breaking changes require a new API version or an explicit compatibility plan.
