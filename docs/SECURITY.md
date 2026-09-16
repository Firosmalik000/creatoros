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
