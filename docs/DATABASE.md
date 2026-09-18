# Database

PostgreSQL is the system of record. Redis is used only for ephemeral concerns such as rate limits, locks, queues, and caches; it is never the sole source of durable business state.

## Conventions

- IDs use UUIDs consistently; time-sortable UUIDv7 is preferred where supported.
- Timestamps are UTC `timestamptz` values.
- Money uses `bigint` minor units plus a required ISO 4217 currency code.
- State fields use constrained values and backend transition validation.
- User-generated historical files and brief versions are append-only rather than overwritten.
- Every schema change is introduced by a paired, versioned migration.

## Phase 1 identity schema

- `users` stores normalized unique email, Argon2id password hashes, verification state, and preferred locale.
- `roles`, `permissions`, `user_roles`, and `role_permissions` enforce durable role assignments and permission grants.
- `auth_sessions` stores hashed opaque session and CSRF tokens with expiry and revocation timestamps.
- `email_verification_tokens` and `password_reset_tokens` store only token hashes and are one-time consumable.
- Registration, role assignment, and verification-token creation are one transaction.
- Password reset consumes the token, updates the password, and revokes every existing session in one transaction.

Migrations run through `cmd/migrate` and are serialized with a PostgreSQL advisory lock. Every `.up.sql` has a paired `.down.sql`; production rollback still requires an explicit data-impact review.
