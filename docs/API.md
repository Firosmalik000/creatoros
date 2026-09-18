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

Authentication uses the HttpOnly `creatoros_session` cookie. State-changing authenticated requests must also send `X-CSRF-Token` matching the session-bound `creatoros_csrf` cookie. Raw session and one-time tokens are never stored in authentication tables; only SHA-256 hashes are persisted there. Production verification and reset links are queued atomically in a durable outbox whose payload is encrypted with AES-256-GCM.

Production requires a canonical HTTPS `PUBLIC_WEB_URL`, an outbox encryption key, and an SMTP STARTTLS relay. Registration and eligible password-reset requests queue localized email in the same transaction as the token. A worker retries failed delivery with capped exponential backoff. Local and test environments may omit email configuration and expose verification/reset tokens in response `meta`; production responses never expose them.

Public auth endpoints are rate-limited in Redis by a hash of the network peer and by a hash of the relevant account/token identifier. Limits fail closed when Redis is unavailable and return `429` with `Retry-After` when exceeded. Deployments behind a BFF or reverse proxy must also enforce client-IP rate limits at the trusted edge because the API deliberately does not trust arbitrary forwarded-IP headers.

Breaking changes require a new API version or an explicit compatibility plan.
