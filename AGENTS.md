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
11. Standardize responsive design across all viewports (`xs`, `sm`, `md`, `lg`, `xl`, `2xl`): zero horizontal scrollbars, minimum 44px touch targets on mobile, and collapsible navigation below `lg`.
12. Support dual-theme (Dark and Light modes) across all operational surfaces and dashboards with semantic color tokens.

## Responsive Breakpoint Standards

Always follow the standard 6-tier viewport breakpoints:

- **`xs` (< 480px / 320px–479px, compact mobile)**:
  - Layout: Single-column for primary content, 2-column max for compact key metrics.
  - Controls: Full-width action buttons and inputs where appropriate; minimum 44×44px touch target.
  - Typography: Scaled with `clamp()`; no text overflow or label clipping.
  - Spacing: Compact container padding (`px-3 py-4`).
  - Strict zero tolerance for unintended horizontal scrollbars (`overflow-x: hidden` on viewport shells).
- **`sm` (≥ 640px, large mobile / phablets)**:
  - Layout: 2-column cards, flexible filter rows, horizontal scroll tabs with indicator.
  - Spacing: Standard mobile padding (`px-4 sm:px-6`).
- **`md` (≥ 768px, tablets / portrait iPad)**:
  - Navigation: Mobile hamburger drawer triggers below `lg`; modal dialogs center with maximum width.
  - Grid: 2 to 3 columns for card lists and metrics.
- **`lg` (≥ 1024px, laptops / compact desktop)**:
  - Navigation: Permanent desktop sidebar (`w-72`), expanded workspace shell.
  - Layout: Multi-column split views (e.g. order details and deliverables side by side).
- **`xl` (≥ 1280px, standard desktop)**:
  - Shell: Max-width capped container (`max-w-7xl` or `1280px`) centered with generous breathing room.
- **`2xl` (≥ 1536px, ultra-wide / high-res monitors)**:
  - Layout: Proportional padding, capped line lengths (60–75ch) for readable editorial content.

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
