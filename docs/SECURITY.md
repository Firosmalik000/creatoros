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
- Session cookies are HttpOnly and SameSite=Lax; production sets `Secure` through configuration.
- Authenticated mutations require a random session-bound CSRF cookie and matching header.
- Verification and reset tokens expire, are one-time use, and are stored only as hashes.
- Password reset revokes all active sessions atomically.
- Forgot-password responses do not reveal whether an account exists.
- Public registration permits only `client` and `creator`; `admin` cannot be self-assigned.
- Roles and permissions returned to clients are descriptive; backend middleware remains authoritative.
- CORS credentials are allowed only for configured web origins.
