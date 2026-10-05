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

## ADR 006: Supabase Storage Bucket Isolation & RLS Enforcement (Phase 5 Requirement)
- **Status:** Accepted
- **Context:** PostgreSQL RLS applied to tables (`documents`, `clients`, etc.) does not automatically protect files stored in Supabase Storage buckets. Unchecked storage access could allow cross-tenant file downloads if a user guesses a direct URL.
- **Decision:** All files must be stored with an explicit organization prefix: `documents/<org_id>/<document_id>/original.<ext>`. Dedicated RLS policies on `storage.objects` (`documents_select_member`, `documents_insert_writer`, `documents_delete_owner`) enforce that users can only upload and read files where the first path segment matches an `org_id` they belong to in `memberships`. Objects are immutable (`upsert: false`, no UPDATE policy). Direct public URLs are disabled; only signed short-lived URLs (expires in 300s) are issued.

## ADR 007: Two-Phase Signed Uploads & Direct-to-Storage Architecture (Phase 5.1 - 5.4)
- **Status:** Accepted
- **Context:** Vercel Serverless Functions reject request bodies over ~4.5 MB. Ingesting 10 MB invoice PDFs or high-resolution photos through Next.js route handlers would work on localhost and immediately fail in production.
- **Decision:** Use a two-phase signed upload protocol:
  1. `requestUploadAction`: Verifies org membership role (`owner` or `accountant`), rate limits, allow-list, generates `crypto.randomUUID()`, reserves `pending_validation` row, and issues a session-scoped signed upload URL.
  2. Browser uploads directly to Supabase Storage with `upsert: false`.
  3. `finalizeUploadAction`: Server reads stored binary and executes strict sequential validation (Size $\rightarrow$ Magic bytes $\rightarrow$ Declared vs Detected type $\rightarrow$ PDF security heuristics $\rightarrow$ Sharp decompression bomb & EXIF strip $\rightarrow$ SHA-256 duplicate detection $\rightarrow$ Filename sanitization).
  4. Scheduled daily cron job at 02:00 UTC (`/api/cron/cleanup-uploads`, schedule `0 2 * * *` per Vercel Hobby plan daily restriction) sweeps rows in `pending_validation` older than 1 hour.

## ADR 008: Malware Scanning Gap & PDF Heuristic Pre-Filtering (Phase 5.6)
- **Status:** Accepted (Documented Known Gap)
- **Context:** Traditional antivirus engines like ClamAV cannot run within lightweight Vercel serverless environments. Claiming active malware scanning exists without infrastructure is a security falsehood.
- **Decision:** 
  1. Record `scan_status = 'skipped'` explicitly on every document row in `documents` table and audit log.
  2. Implement an in-memory heuristic token scanner for PDFs checking uncompressed byte sequences for `/JavaScript`, `/JS`, `/Launch`, and `/EmbeddedFile`.
  3. **Explicit Heuristic Limitation:** Raw token scanning does not detect active content hidden inside compressed FlateDecode streams or advanced PDF obfuscation. It serves solely as a fast, first-line hygiene filter before vision model ingestion.
  4. **Future Roadmap:** Route finalized files to an asynchronous queue (Phase 6) that calls an external scanning API (e.g. VirusTotal or an AWS S3 ClamAV Lambda sidecar) before extraction.

## ADR 009: Durable Rate Limiting, Indexing & Fail-Open Resilience Strategy
- **Status:** Accepted
- **Context:** Serverless functions are stateless and scale across multiple edge instances. In-memory rate limiting does not prevent distributed quota abuse. At the same time, as `audit_log` grows, count queries without indexes will degrade latency.
- **Decision:**
  1. **PostgreSQL-Backed Count Queries:** `checkUploadRateLimitDurable` queries `audit_log` records: actor upload count over the last 10 minutes (limit 30) and org upload count over the last 24 hours (limit 200).
  2. **Composite Indexes:** Backed by `idx_audit_log_org_action_created ON audit_log (org_id, action, created_at)` and `idx_audit_log_actor_action_created ON audit_log (actor_id, action, created_at)` created in migration `20261005000009`.
  3. **Fail-Open Strategy:** If the database query times out or fails, the rate limiter catches the exception and falls back to the in-memory counter (`checkUploadRateLimit`). This guarantees document ingestion remains available during transient database degradation.
  4. **Cron Security:** In production, `/api/cron/cleanup-uploads` fails closed (401 Unauthorized) if `CRON_SECRET` is unset or mismatched. Schedule is set to `0 2 * * *` (once daily) to comply with Vercel Hobby limits.

