# Database

PostgreSQL is the system of record. Redis is used only for ephemeral concerns such as rate limits, locks, queues, and caches; it is never the sole source of durable business state.

## Conventions

- IDs use UUIDs consistently; time-sortable UUIDv7 is preferred where supported.
- Timestamps are UTC `timestamptz` values.
- Money uses `bigint` minor units plus a required ISO 4217 currency code.
- State fields use constrained values and backend transition validation.
- User-generated historical files and brief versions are append-only rather than overwritten.
- Every schema change is introduced by a paired, versioned migration.

The Phase 0 migration only enables foundation extensions. Domain tables begin with the phase that owns their behavior.
