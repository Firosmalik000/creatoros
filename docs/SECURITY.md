# Security Baseline

- Backend authorization is mandatory; frontend role checks are presentational only.
- Production authentication uses secure, HTTP-only cookies where possible; long-lived tokens do not belong in local storage.
- Passwords will use Argon2id with reviewed parameters.
- State-changing cookie-authenticated requests require CSRF protection.
- CORS uses an explicit allowlist.
- Uploads require size, MIME, extension, and content validation; large media uploads use signed object-storage URLs.
- Payment webhooks require signature verification, idempotency, database transactions, and durable event records.
- Secrets are supplied through environment-specific secret management and never committed.
- Critical admin, payment, payout, workflow, and identity actions produce immutable audit records.

Security controls must be tested at the phase that introduces the protected behavior.

## Phase 1 authentication controls

- Passwords are hashed with Argon2id using per-password cryptographic salts.
- Sessions use random opaque 256-bit tokens stored only as SHA-256 hashes.
- Session cookies are HttpOnly and SameSite=Lax; production defaults `Secure` on and rejects an explicit insecure override.
- Authenticated mutations require a random session-bound CSRF cookie and matching header.
- Verification and reset token records store only hashes. Encrypted outbox payloads are cleared after delivery or expiry.
- Password reset revokes all active sessions atomically.
- Forgot-password responses do not reveal whether an account exists.
- Public registration permits only `client` and `creator`; `admin` cannot be self-assigned.
- Roles and permissions returned to clients are descriptive; backend middleware remains authoritative.
- CORS credentials are allowed only for configured web origins.
- Redis-backed limits protect public auth endpoints by hashed network/account/token keys and fail closed if Redis is unavailable.
- Production verification and password-reset messages use a canonical configured origin, an AES-256-GCM encrypted durable outbox, SMTP STARTTLS, and retry backoff. The encryption key must remain available for queued messages and be managed as a production secret.
- Forwarded client-IP headers are not trusted by the API. A trusted edge must enforce real client-IP limits when traffic reaches the API through a shared BFF/proxy peer.
