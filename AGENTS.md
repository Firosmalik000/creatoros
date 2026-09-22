# Agent Working Contract

Before implementation, read `README.md`, `PRODUCT.md`, `DESIGN.md`, `docs/ROADMAP.md`, all files in `docs/`, and `openapi/openapi.yaml` relevant to the task.

## Non-negotiable rules

1. Preserve the modular monolith and existing module boundaries.
2. Keep authoritative business rules in the Go API.
3. Enforce authorization on the backend.
4. Store money as integer minor units with an explicit currency.
5. Use versioned database migrations and update OpenAPI with contract changes.
6. Use translation keys for system UI; never hardcode locale or currency formatting.
7. Every async UI needs relevant loading, error, empty, and success states.
8. Public pages must consider metadata, canonical, hreflang, structured data, accessibility, and responsive behavior.
9. Add or update tests and run lint, typecheck, tests, and build before completion.
10. Avoid broad unrelated refactors and premature abstractions.

## Phase tracking checklist

`docs/ROADMAP.md` is the detailed source of truth. Never mark a phase complete until every exit gate has recent verification evidence in its evidence log.

- [x] Phase 0 — Foundation (verified 2026-09-15; evidence in `docs/ROADMAP.md`)
- [x] Phase 1 — Auth & User (verified 2026-09-18; evidence in `docs/ROADMAP.md`)
- [x] Phase 2 — Creator Foundation (verified 2026-09-19; evidence in `docs/ROADMAP.md`)
- [x] Phase 3 — Marketplace (verified 2026-09-19; evidence in `docs/ROADMAP.md`)
- [x] Phase 4 — Services (verified 2026-09-19; evidence in `docs/ROADMAP.md`)
- [x] Phase 5 — Order (verified 2026-09-19; evidence in `docs/ROADMAP.md`)
- [x] Phase 6 — Content Workflow (verified 2026-09-19; evidence in `docs/ROADMAP.md`)
- [x] Phase 7 — Campaign (verified 2026-09-19; evidence in `docs/ROADMAP.md`)
- [x] Phase 8 — Payment (verified 2026-09-21; evidence in `docs/ROADMAP.md`)
- [x] Phase 9 — Communication (verified 2026-09-21; evidence in `docs/ROADMAP.md`)
- [x] Phase 10 — Admin (verified 2026-09-21; evidence in `docs/ROADMAP.md`)
- [x] Phase 11 — SEO & Content (verified 2026-09-21; evidence in `docs/ROADMAP.md`)
- [x] Phase 12 — Production Hardening (verified 2026-09-21; evidence in `docs/ROADMAP.md`)
- [x] Phase 13 — Pilot (verified 2026-09-21; evidence in `docs/ROADMAP.md`)
- [x] Phase 14 — Production (verified 2026-09-21; evidence in `docs/ROADMAP.md`)

When working on a phase:

1. Confirm prerequisite phases and acceptance criteria.
2. Update the relevant checklist while preserving unchecked work.
3. Record migrations, OpenAPI changes, authorization rules, and tests.
4. Run the phase quality gates and add dated evidence.
5. Mark the phase complete only when all checklist items and exit gates pass.
