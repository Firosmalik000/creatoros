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
- `email_outbox` durably stores encrypted verification/reset payloads; token issuance and enqueueing share one transaction, and payload bytes are cleared after delivery or expiry.
- An `active` user must have `email_verified_at`; consuming a verification token cannot transition a disabled account.

Migrations run through `cmd/migrate` and are serialized with a PostgreSQL advisory lock. Every `.up.sql` has a paired `.down.sql`; production rollback still requires an explicit data-impact review.

## Phase 2 creator schema

- `creator_profiles` is owned one-to-one by a creator user and has a unique public slug plus a constrained verification status.
- `platforms` and localized `categories` are agency-controlled reference data. Join tables enforce valid category, platform, and language references.
- `creator_social_accounts` stores integer followers/views and engagement basis points; a creator has at most one account per platform.
- `creator_portfolios` stores ordered external HTTPS work references until managed uploads arrive in a later phase.
- `creator_verification_events` is append-only audit history for submit, review, suspension, and review-reset transitions.
- Onboarding aggregate writes replace profile-owned collections in one transaction. Any invalid reference rolls the complete write back.
- Editing a reviewed profile returns it to `draft`. Public reads join an active user and require `verification_status = 'verified'`, so non-verified data is excluded at the database query boundary.

## Phase 3 marketplace schema

- `creator_favorites` stores the client-to-creator relationship with a composite primary key, cascading cleanup, and a client-role permission assignment.
- Directory reads derive follower and engagement aggregates from creator evidence and only include active, verified profiles. Favorite writes are idempotent and never overwrite creator-owned data.
