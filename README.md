# CreatorOS

Production-oriented foundation for a curated creator marketplace and agency operating system.

## Repository

```text
apps/web       Next.js 16 public web application
apps/api       Go 1.27 REST API modular monolith
openapi        API contract
docs           Product and engineering documentation
infra          Container definitions
```

Delivery progress and Phase 0–14 exit gates are tracked in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Prerequisites

- Node.js 24 LTS and npm 11+
- Go 1.27+
- Docker with Compose v2

The current local machine may use a newer Node release for checks, but CI and containers pin Node 24.

## Setup

```bash
npm install
cp .env.example .env
make dev
```

Without Docker, run the web app with `npm run dev:web`. The API requires Go 1.27.

Ports are configurable through `.env`. Defaults are web `3000`, API `8080`, MinIO API `9000`, and MinIO Console `9002`. On this workstation, the ignored local `.env` uses web port `3001` because port `3000` is already occupied by another project.

Phase 1 authentication pages are available under `/{locale}/auth/register` and `/{locale}/auth/login`; authenticated account settings live at `/{locale}/settings`. Docker Compose runs versioned migrations before starting the API.

Phase 2 creator onboarding is available at `/{locale}/creator/onboarding`; agency reviewers use `/{locale}/admin/creator-verifications`. Approved creators receive an indexable public profile at `/{locale}/creators/{slug}`. Local admin access must be assigned directly in the database or through a controlled seed because public registration never grants the `admin` role.

Verified creators manage service drafts and packages at `/{locale}/creator/services`. Published offers resolve at `/{locale}/creators/{creator-slug}/services/{service-slug}`; editing a published offer returns it to draft until it is explicitly republished.

Production auth additionally requires Redis, `PUBLIC_WEB_URL`, `OUTBOX_ENCRYPTION_KEY`, and an SMTP STARTTLS relay. See `.env.example` and `docs/SECURITY.md`; startup fails closed when production cookie or email delivery settings are unsafe or incomplete.

## Quality commands

```bash
make lint
make typecheck
make test
make build
```

## Architecture rules

The API is the authority for permissions, money, and state transitions. UI text uses locale dictionaries. API shape changes must update `openapi/openapi.yaml`, and persistence changes require versioned migrations.
