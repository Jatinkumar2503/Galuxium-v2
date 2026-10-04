# Galuxium Nexus V2: Architectural Decision Records (ADRs)

## ADR 001: Next.js 15 App Router & Strict TypeScript
- **Status:** Accepted
- **Context:** Galuxium requires high-speed document ingestion, real-time extraction streaming, and zero-latency client switching for Indian accountants.
- **Decision:** Use Next.js 15 with App Router, React 19 Server Components, and strict TypeScript.
- **Consequences:** Eliminates client-bundle overhead on initial load, enables streaming server-sent events for invoice extraction updates, and guarantees type safety from database schema to UI components.

## ADR 002: Multi-Tenant Isolation via PostgreSQL Row-Level Security (RLS)
- **Status:** Accepted
- **Context:** Multiple SME clients and accounting firms share the platform. Data leakage between organizations is fatal for statutory and client-trust reasons.
- **Decision:** Enforce multi-tenancy at the PostgreSQL level via Supabase RLS. Every tenant table carries an indexed `org_id` column with default-deny policies. Application-level queries must evaluate under the authenticated JWT role.
- **Consequences:** Cross-tenant reads/writes are mathematically blocked by Postgres kernel, even if an application route has a logic vulnerability.

## ADR 003: Progressive Account Lockout via Custom Table
- **Status:** Accepted
- **Context:** Supabase Auth provides general rate limits but lacks progressive per-account lockout (1 min, 5 min, 15 min lockouts after 5 consecutive failures).
- **Decision:** Implement a dedicated `auth_failed_attempts` table checked by server actions before delegating credentials to Supabase Auth, combined with Cloudflare Turnstile bot challenges after 3 failures.
- **Consequences:** Protects against distributed credential stuffing without penalizing legitimate sessions or imposing arbitrary caps on successful logins.

## ADR 004: Warm Neutrals Color Direction & WCAG 2.1 AA Contrast Enforcement
- **Status:** Accepted
- **Context:** High-end financial software often relies on generic cold blues or greens. Galuxium adopts an archival, warm paper-and-bronze design philosophy evoking Indian ledger books (*Bahi Khata*).
- **Decision:** Restrict palette strictly to warm neutrals:
  - Background: Off-white `#F7F4EE`
  - Surface: Pearl white `#EFEBE3`
  - Raised cards: Cream `#F3EBD8`
  - Border: Warm sand `#D9D0BF`
  - Primary text: Warm charcoal `#2B2824`
  - Secondary text: Taupe `#6E665A`
  - Accent: Antique gold `#B08D57` (restricted to icons, borders, cards, and large headlines due to 2.8:1 contrast on off-white)
  - Warning: Amber `#C98A2B` (used with charcoal/bronze text)
  - Error: Terracotta `#B5523B`
  - Success: Deep bronze `#8A6A3B` (passes 4.5:1 AA contrast)
- **Consequences:** Absolute prohibition of blue and green. Guaranteed accessibility compliance through strict token usage rules.

## ADR 005: 3D Spatial Canvas Architecture
- **Status:** Accepted
- **Context:** Need a dynamic, alive interface that sets Galuxium apart in hackathon judging while keeping performance at 60fps on mid-range laptops.
- **Decision:** React Three Fiber + Drei rendering warm floating geometric paper planes, rings, and spheres with ambient drift, scroll-coupled camera fly-through, and pointer parallax. Canvas pauses when tab loses focus and falls back gracefully for `prefers-reduced-motion`.
