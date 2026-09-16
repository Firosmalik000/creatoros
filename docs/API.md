# API

The REST API is served under `/api/v1`. `openapi/openapi.yaml` is the contract authority.

## Envelope

Successful business responses use `data` and optional `meta`. Errors use a stable machine-readable code, a developer-facing message, and optional details. Frontends localize by code rather than displaying backend strings directly.

## Implemented in Phase 0

- `GET /health/live`: process liveness.
- `GET /health/ready`: dependency readiness. Phase 0 reports process readiness until database wiring is introduced.

Breaking changes require a new API version or an explicit compatibility plan.
