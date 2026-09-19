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
- `GET /api/v1/catalog/creator-options`: return active platforms and localized creator categories.
- `GET /api/v1/creators`: discover verified creators with bounded search, category/language/country filters, deterministic sorting, and pagination. A valid session cookie personalizes each card's `is_favorite`; anonymous or expired sessions see `false`. The response is private and not cacheable.
- `GET /api/v1/me/favorites`: list the authenticated client's favorite creators; `POST|DELETE /api/v1/me/favorites/{slug}` adds or removes a favorite and requires CSRF validation.
- `GET /api/v1/creators/{slug}`: return a public profile only when the creator and account are active and verified.
- `GET|PUT /api/v1/creators/me/onboarding`: read or atomically replace the authenticated creator's profile and evidence; writes require CSRF validation.
- `POST /api/v1/creators/me/verification-submissions`: submit a complete creator profile; requires CSRF validation.
- `GET /api/v1/admin/creator-verifications`: list profiles by verification status; requires the review permission.
- `GET /api/v1/admin/creator-verifications/{user_id}`: inspect complete creator evidence; requires the review permission.
- `POST /api/v1/admin/creator-verifications/{user_id}/decisions`: approve, request revision, reject, or suspend according to the state transition rules; requires the review permission and CSRF validation.
- `GET|POST /api/v1/creators/me/services`: list owned services or create an owned draft with one to three packages; creation requires CSRF validation.
- `GET|PUT /api/v1/creators/me/services/{service_id}`: read or atomically replace an owned service and packages; replacement requires CSRF and returns the service to draft.
- `POST /api/v1/creators/me/services/{service_id}/publish|unpublish`: explicitly change public availability; requires ownership, creator permission, and CSRF validation.
- `GET /api/v1/creators/{creator_slug}/services`: list only published services owned by an active, verified creator.
- `GET /api/v1/creators/{creator_slug}/services/{service_slug}`: return one public service with selectable packages.

Authentication uses the HttpOnly `creatoros_session` cookie. State-changing authenticated requests must also send `X-CSRF-Token` matching the session-bound `creatoros_csrf` cookie. Raw session and one-time tokens are never stored in authentication tables; only SHA-256 hashes are persisted there. Production verification and reset links are queued atomically in a durable outbox whose payload is encrypted with AES-256-GCM.

Production requires a canonical HTTPS `PUBLIC_WEB_URL`, an outbox encryption key, and an SMTP STARTTLS relay. Registration and eligible password-reset requests queue localized email in the same transaction as the token. A worker retries failed delivery with capped exponential backoff. Local and test environments may omit email configuration and expose verification/reset tokens in response `meta`; production responses never expose them.

Public auth endpoints are rate-limited in Redis by a hash of the network peer and by a hash of the relevant account/token identifier. Limits fail closed when Redis is unavailable and return `429` with `Retry-After` when exceeded. Deployments behind a BFF or reverse proxy must also enforce client-IP rate limits at the trusted edge because the API deliberately does not trust arbitrary forwarded-IP headers.

Breaking changes require a new API version or an explicit compatibility plan.

Creator social audience counts are integers. Engagement is represented as basis points (`640` means `6.40%`) rather than floating-point. Saving onboarding replaces the creator-owned category, language, social, and portfolio collections in one transaction. A reviewed profile that is edited returns to `draft` and immediately stops resolving from the public endpoint until approved again.

Service money uses `price_minor` integers plus explicit `currency`. IDR values are whole rupiah; MYR and USD values are cents. Saving a service atomically replaces its packages and clears publication. Only the Go API may publish a service, after checking ownership, creator verification, account status, and package completeness.
