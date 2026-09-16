# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 App Router and React 19 for the web application; Go 1.27 with Chi for the API; PostgreSQL, Redis, and S3-compatible object storage. The repository is a modular monolith and uses REST/OpenAPI as the frontend-backend contract.

## Users

- Brands and client teams discover verified creators, purchase services, and manage campaigns.
- Creators publish services, respond to opportunities, deliver content, and receive payouts.
- Agency staff verify talent, manage quality, operations, finance, disputes, and platform configuration.

## Product Purpose

The product makes it possible to find, hire, and manage verified content creators in one place. Success means a brand can move from creator discovery through approved content, while the creator and agency can operate the same workflow with clear ownership and auditability.

## Positioning

This is a managed creator marketplace: discovery and transactions are combined with agency quality control and a curated, performance-aware creator network.

## Operating Context

The product supports direct-hire orders and larger managed campaigns. The core work artifacts are creator profiles, services and packages, versioned briefs, submissions, revisions, approvals, payments, commissions, payouts, and contextual conversations.

## Capabilities and Constraints

- Initial markets: Indonesia, Malaysia, and international clients.
- Locales: Indonesian (`id-ID`), English (`en`), and Malaysian Malay (`ms-MY`).
- The Go backend owns authorization, workflow transitions, financial calculations, and audit history.
- Money is stored as integer minor units with an explicit currency; floating-point arithmetic is prohibited.
- Only verified creators are publicly discoverable.
- Public pages are SEO-first; dashboards and transactional pages are not indexable.
- WCAG 2.2 AA is the accessibility target.
- Product name is open. `CreatorOS` is a replaceable working name, not a confirmed brand commitment.

## Brand Commitments

Premium, trustworthy, modern, content-first, and creative without becoming overly corporate or playful. The experience may draw from the usability of Airbnb, Fiverr, and Contra, but must retain an independent identity.

## Evidence on Hand

The master blueprint supplied by the user is the current source of truth. No production creator data, testimonials, logos, customer claims, or legal copy have been supplied. Demonstration content must be labeled as illustrative.

## Product Principles

- Agency-managed trust is part of the product, not a marketing veneer.
- Structured briefs and stateful workflows replace fragile chat-only coordination.
- Backend authority and traceable transitions protect users and money.
- Multilingual, mobile-first access is foundational rather than an add-on.
- Build the complete core workflow before speculative automation or AI.

## Accessibility & Inclusion

The interface targets WCAG 2.2 AA, keyboard access, visible focus, semantic controls, screen-reader status, accessible dialogs and forms, and responsive use from 320px upward.
