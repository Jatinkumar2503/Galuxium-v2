# Galuxium Nexus V2: Master Roadmap
**Project:** AI invoice reconciliation and compliance platform for Indian SMEs and accountants  
**Target Deadline:** Oct 28, 2026 (Devpost: Oct 31, 2026)  
**Total Target Commits:** 200 (10 Phases × 10 Instructions × 2 Commits)

---

## Strict Rules
1. A phase is complete only when **all 10 instructions are done** and the **Exit Gate** passes.
2. **Do not start Phase N+1 until Phase N is signed off.** No exceptions.
3. If an instruction cannot be done, fix the blocker or replace the instruction in writing.
4. `main` is always deployable.
5. Commit at least daily with meaningful, structured messages.
6. Mark each instruction `[x]` only after verifying and testing it.

## Design Palette (Warm Neutrals Only - Zero Blue, Zero Green)
- **Background (Off-white):** `#F7F4EE`
- **Surface (Pearl white):** `#EFEBE3`
- **Raised surface / cards (Cream):** `#F3EBD8`
- **Border / dividers (Warm sand):** `#D9D0BF`
- **Primary text (Warm charcoal):** `#2B2824`
- **Secondary text (Taupe):** `#6E665A`
- **Accent (Antique gold):** `#B08D57` *(Strictly for icons, borders, cards, and large headings. Fails AA contrast 2.8:1 on off-white for body text)*
- **Warning / needs review (Amber):** `#C98A2B` *(Use as badge/icon with charcoal or bronze text to maintain WCAG AA)*
- **Error / rejected (Terracotta):** `#B5523B`
- **Success / matched (Deep bronze + check):** `#8A6A3B` *(Passes 4.5:1 AA contrast ratio on off-white)*

---

## Architecture Implementation Notes
- **Instruction 2.6 / 8.2 (Audit Hash-Chain Concurrency):** Serialized per organization using `PERFORM pg_advisory_xact_lock(hashtext(NEW.org_id::text));` inside `trg_audit_log_compute_hash()` to prevent race condition hash forks.
- **Instruction 3.5 (Auth Security):** Supabase Auth lacks native progressive account lockout. Implemented via custom `auth_failed_attempts` table checked before authentication with progressive backoff (1m, 5m, 15m) and Cloudflare Turnstile challenge after 3 failures.
- **Service Role Key Security:** Scanned via automated security tests ensuring `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-side admin client and never referenced in client code.
- **Phase 5 Pre-Requisite (Storage):** Supabase Storage buckets are not covered by table RLS; dedicated `storage.objects` policies with `org_id` prefix isolation are documented in ADR 006.

---

## PHASE 1: Foundation and Project Setup (10/10 Complete)
*Goal: a deployed, empty, professional skeleton.*

- [x] 1.1 Finalize the product name and register the domain or Vercel project name.
- [x] 1.2 Create the public GitHub repo with README stub, license, `.gitignore`, and issue templates.
- [x] 1.3 Scaffold Next.js (App Router) + TypeScript (strict mode) + Tailwind.
- [x] 1.4 Configure ESLint, Prettier, and a pre-commit hook (lint + typecheck).
- [x] 1.5 Set up GitHub Actions CI: install, lint, typecheck, test, build on every push.
- [x] 1.6 Create the Supabase project and store all keys in environment variables, never in code.
- [x] 1.7 Add `.env.example` and a startup check that fails fast if required variables are missing.
- [x] 1.8 Deploy the empty app to Vercel with preview deployments per branch.
- [x] 1.9 Set up Sentry for error tracking and a basic `/api/health` endpoint.
- [x] 1.10 Write `docs/DECISIONS.md` recording stack choices and why.

**Exit Gate:** a push to a branch runs CI green, produces a preview URL, and the production URL loads. No secrets in the repo history. — **PASSED (Verified Oct 05, 2026)**

---

## PHASE 2: Database, Multi-Tenancy, and Row-Level Security (10/10 Complete)
*Goal: data isolation proven before any feature touches it.*

- [x] 2.1 Design the schema: `organizations`, `memberships`, `clients`, `documents`, `extractions`, `bank_transactions`, `matches`, `flags`, `audit_log`, `usage_events`, `api_keys`.
- [x] 2.2 Write migrations as versioned SQL files in the repo (no manual dashboard edits).
- [x] 2.3 Add `org_id` to every tenant table with foreign keys and indexes.
- [x] 2.4 Enable RLS on **every** table; default deny.
- [x] 2.5 Write policies by role: owner, accountant, viewer.
- [x] 2.6 Create the append-only `audit_log` trigger (block UPDATE and DELETE) + advisory lock hash chain.
- [x] 2.7 Add a duplicate-detection hash column and unique constraint on `documents`.
- [x] 2.8 Write a seed script producing two demo orgs plus one accountant managing both.
- [x] 2.9 Write automated RLS tests: user from Org A must never read or write Org B data, viewer cannot write, removed member immediately revoked.
- [x] 2.10 Generate TypeScript types from the schema and add an ER diagram to `docs/`.

**Exit Gate:** the RLS test suite passes in CI with real Postgres. Attempting cross-tenant reads through the API returns nothing. Audit log rejects edits. — **PASSED (Verified Oct 05, 2026)**

---

## PHASE 3: Authentication and Session Security (10/10 Complete)
*Goal: secure sign-in with Google and email/password, with login limits.*

- [x] 3.1 Enable Google OAuth (Supabase Auth) with a correctly configured consent screen and exact redirect URIs for local, preview, and production.
- [x] 3.2 Enable email + password sign-up with email verification required before access.
- [x] 3.3 Enforce password policy: minimum 8 characters (aligned with Google identity standard), check against a breached-password list, no composition gimmicks.
- [x] 3.4 Build sign-up, login, logout, forgot-password, and reset-password flows with clear, non-leaking error messages ("Invalid email or password").
- [x] 3.5 Login rate limiting: max 5 failed attempts per account + IP per 15 minutes, then progressive lockout (1 min, 5 min, 15 min), plus a bot challenge (e.g., Turnstile) after 3 failures. Add a separate IP-level limit on sign-up and reset requests.
- [x] 3.6 Use secure session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`; short-lived access token with refresh rotation.
- [x] 3.7 Account linking: the same verified email via Google and password resolves to one account, never two.
- [x] 3.8 Route protection: middleware guards all app routes; role checks happen on the server, never only in the UI.
- [x] 3.9 Log auth events (login, failure, lockout, password change, new device) to the audit log, and show "recent activity" to the user.
- [x] 3.10 Optional but recommended: TOTP two-factor authentication for owner and accountant roles; add a "sign out of all devices" button.

**Exit Gate:** you can register by Google and by email, verify, log in, log out, and reset a password. Six wrong passwords trigger lockout. An unauthenticated request to any protected route is rejected. — **PASSED (Verified Oct 05, 2026)**

---

## PHASE 4: Design System and 3D Frontend Shell (10/10 Complete)
*Goal: the signature look, built once and reused everywhere.*

- [x] 4.1 Define design tokens (the palette above) as CSS variables; add a lint rule or test that rejects blue/green hues.
- [x] 4.2 Choose type: a refined serif for headlines plus a clean sans for UI; set a type scale and spacing scale.
- [x] 4.3 Install **React Three Fiber + drei**; build a persistent full-viewport 3D canvas layer behind the UI.
- [x] 4.4 Create the hero scene: pearl, cream, and gold floating 3D forms (e.g., stacked paper-like invoice planes, rings, soft spheres) with soft warm lighting and subtle shadows.
- [x] 4.5 Ambient motion: objects continuously float, rotate, and drift on slow independent paths (idle animation never stops).
- [x] 4.6 Scroll-driven camera: scroll moves the camera through the scene (fly-through, orbit, zoom) so each section changes the 3D view.
- [x] 4.7 Pointer and touch interaction: the scene parallaxes and tilts toward the cursor or device tilt/touch drag, with smooth damping (full range of motion, not just hover states).
- [x] 4.8 Build core UI components (buttons, inputs, cards, tables, modals, toasts) in glass-like pearl and cream styling with soft depth.
- [x] 4.9 Performance budget: 60fps on a mid-range laptop, 3D assets under 2MB, lazy-load the canvas, lower quality on weak GPUs, pause when the tab is hidden.
- [x] 4.10 Accessibility and fallbacks: `prefers-reduced-motion` switches to a static/gentle scene, keyboard focus is visible (in gold, not blue), text contrast meets WCAG AA, and a non-WebGL fallback image exists.

**Exit Gate:** landing page and the logged-in shell run at 60fps on desktop and a mid-range phone, motion responds to scroll, cursor, and touch, contrast checks pass, and reduced-motion mode works. — **PASSED (Verified Oct 05, 2026)**

---

## PHASE 5: Document Ingestion and Storage (4/10)
*Goal: files go in safely and reliably.*

- [x] 5.1 Build drag-and-drop and camera/photo upload for PDF, JPG, PNG, and HEIC.
- [x] 5.2 Build bank statement CSV import with column mapping and a preview step.
- [x] 5.3 Store files in private Supabase Storage buckets with per-org path prefixes and storage RLS.
- [x] 5.4 Validate server-side: file type by magic bytes (not extension), size limit (e.g., 10MB), page limit.
- [ ] 5.5 Compute a content hash and block exact duplicate uploads, with a clear message.
- [ ] 5.6 Virus/malware scanning (e.g., ClamAV service or a scanning API) before a file is processed (ADR-008 documented gap).
- [ ] 5.7 Use signed, short-lived URLs for viewing files; never expose public URLs.
- [ ] 5.8 Show upload progress, per-file status, and retry on failure.
- [ ] 5.9 Build bulk upload (many files at once) with a queue indicator.
- [ ] 5.10 Rate-limit uploads per user and per org, and record each upload to `usage_events` and the audit log.

**Exit Gate:** 50 mixed files upload successfully; a renamed `.exe` and a 50MB file are rejected; a second org cannot access the first org's files by URL. — *Pending live Supabase migration & manual multi-tenant check*

---

## PHASE 6: Extraction Pipeline (Queue + AI) (0/10)
*Goal: reliable structured data from messy documents.*

- [ ] 6.1 Set up the job queue (Inngest or Trigger.dev) with retries, backoff, and a dead-letter state.
- [ ] 6.2 Define the invoice JSON schema (vendor, GSTIN, invoice number, dates, line items, tax breakup, totals, currency).
- [ ] 6.3 Integrate a vision-capable LLM for PDFs and photos, returning structured output.
- [ ] 6.4 Validate every output with Zod; reject and retry malformed results.
- [ ] 6.5 Add a per-field confidence score and an overall document confidence.
- [ ] 6.6 Add deterministic checks: GSTIN format, tax arithmetic, date sanity, total = sum of lines.
- [ ] 6.7 Redact PII (e.g., personal phone numbers, account numbers) before storing prompts or logs.
- [ ] 6.8 Track cost and latency per document in `usage_events`.
- [ ] 6.9 Build the 20-document test set (clean, rotated, blurry, handwritten, multi-language) with expected values, and an accuracy report script.
- [ ] 6.10 Show live processing status in the UI (queued, extracting, validated, failed) with real-time updates.

**Exit Gate:** accuracy on the test set meets your written target (set it in 6.9, e.g., 90% of key fields). Failures retry and then land in a visible failed state. No raw PII in logs.

---

## PHASE 7: Matching Engine, Flags, and Review Queue (0/10)
*Goal: the core value, with an explanation for every decision.*

- [ ] 7.1 Implement rule-based matching: amount, date window, and fuzzy vendor name.
- [ ] 7.2 Add a scoring model combining signals into a match score.
- [ ] 7.3 Auto-approve above the high threshold, send mid-range matches to review, leave low scores unmatched.
- [ ] 7.4 Use an LLM only for ambiguous cases, with the reasoning stored.
- [ ] 7.5 Detect duplicates (same invoice twice, near-identical amounts and vendor).
- [ ] 7.6 Detect GST issues: invalid GSTIN, tax mismatch, missing fields, wrong state-based tax type.
- [ ] 7.7 Detect anomalies: amount outliers, unusual dates, split payments, partial payments.
- [ ] 7.8 Generate a plain-English "why was this flagged" explanation for every flag.
- [ ] 7.9 Build the review queue UI: side-by-side document and transaction, approve/reject/reassign, with keyboard shortcuts.
- [ ] 7.10 Write every decision (automatic or human) to the audit log with actor, time, and reason.

**Exit Gate:** on the seeded dataset, known matches and planted errors are caught as expected; every flag has an explanation; every review action appears in the audit log.

---

## PHASE 8: Audit Trail, Compliance, Reports, and Exports (0/10)
*Goal: audit-ready output and demonstrable governance.*

- [ ] 8.1 Build the audit log viewer with filters (actor, action, date, document).
- [ ] 8.2 Add tamper evidence: hash-chain audit entries so tampering is detectable, plus a verify button.
- [ ] 8.3 Generate the reconciliation report (PDF) with summary, matched, unmatched, and flagged sections.
- [ ] 8.4 Export CSV and Excel versions of the report.
- [ ] 8.5 Build the GST summary view (input tax by rate and period).
- [ ] 8.6 Export in Tally-compatible and Zoho Books-compatible formats.
- [ ] 8.7 Data retention settings and a "delete my data" flow that really removes files and rows.
- [ ] 8.8 Data export for users (portability).
- [ ] 8.9 Write the privacy policy and terms of service, and a clear "how AI is used" page (responsible-AI transparency).
- [ ] 8.10 Add a compliance dashboard: encryption status, access log, open flags, last audit verification.

**Exit Gate:** a full month of sample data produces a correct, downloadable report; the hash-chain verifier passes and fails when an entry is manually tampered; deletion removes data from storage and the database.

---

## PHASE 9: Accountant Portal, Billing, Usage Metering, and API (0/10)
*Goal: the revenue story, working end to end.*

- [ ] 9.1 Build the accountant multi-client switcher and per-client dashboards.
- [ ] 9.2 Client invitation flow with role-scoped access and revocation.
- [ ] 9.3 Define plans: Free (e.g., 25 invoices/month), Pro, and per-invoice overage.
- [ ] 9.4 Integrate Stripe or Razorpay in **test mode**: checkout, subscription, cancellation, and webhooks.
- [ ] 9.5 Verify webhook signatures and make handlers idempotent.
- [ ] 9.6 Enforce plan limits server-side (not just in the UI), with friendly upgrade prompts.
- [ ] 9.7 Build the usage dashboard (documents processed, cost, remaining quota).
- [ ] 9.8 Build the public REST API with hashed API keys, scopes, and per-key rate limits.
- [ ] 9.9 Meter API usage and bill it as usage-based events; write short API docs with examples.
- [ ] 9.10 Build admin analytics: volume, error rate, average processing time, cost per invoice, and margin per plan.

**Exit Gate:** you can subscribe in test mode, hit the free limit and get blocked or upsold, call the API with a key, and see usage and billing update correctly. Replaying a webhook does not double-charge.

---

## PHASE 10: Hardening, Documentation, Demo, and Submission (0/10)
*Goal: a polished, verified, submitted entry.*

- [ ] 10.1 Security review: dependency audit, secrets scan, CSP, HSTS, CORS, input validation, and output encoding on every route.
- [ ] 10.2 Penetration-style self-test: IDOR attempts, XSS, CSRF, SQL injection attempts, auth bypass, upload abuse.
- [ ] 10.3 Load-test the pipeline with a few hundred documents and fix the slowest paths.
- [ ] 10.4 Test on a clean account, a phone, a slow network, and at least two browsers.
- [ ] 10.5 Write the README: architecture diagram, tech stack, schema, security model, local setup, and the live link.
- [ ] 10.6 Write the Executive Briefing: market friction, architecture, target cohort.
- [ ] 10.7 Write the Fiscal Architecture: pricing tiers, unit economics per invoice, and revenue model.
- [ ] 10.8 Record the 2-5 minute demo: open on the live product, upload, flagged and explained result, audit log, accountant portal, billing, and the 3D interface.
- [ ] 10.9 Final checklist: live URL works logged out and logged in, sample data is preloaded, repo is public, README renders, and video is public and under 5 minutes.
- [ ] 10.10 Submit on Devpost at least one day early, then re-open every submitted link to verify.

**Exit Gate:** a person who has never seen the project can open the link, sign in with Google, and understand the value within 30 seconds. All submission fields are complete.

---

## Progress Overview
- [x] Phase 1: Foundation and Project Setup (10/10) — Signed Off
- [x] Phase 2: Database, Multi-Tenancy, and Row-Level Security (10/10) — Signed Off
- [x] Phase 3: Authentication and Session Security (10/10) — Signed Off
- [x] Phase 4: Design System and 3D Frontend Shell (10/10) — Signed Off
- [ ] Phase 5: Document Ingestion and Storage (4/10)
- [ ] Phase 6: Extraction Pipeline (Queue + AI) (0/10)
- [ ] Phase 7: Matching Engine, Flags, and Review Queue (0/10)
- [ ] Phase 8: Audit Trail, Compliance, Reports, and Exports (0/10)
- [ ] Phase 9: Accountant Portal, Billing, Usage Metering, and API (0/10)
- [ ] Phase 10: Hardening, Documentation, Demo, and Submission (0/10)

---

## Phase Sign-Off Log
| Phase | All 10 done | Exit gate passed | Date |
|---|---|---|---|
| 1 | [x] Yes | [x] Yes | Oct 05, 2026 |
| 2 | [x] Yes | [x] Yes | Oct 05, 2026 |
| 3 | [x] Yes | [x] Yes | Oct 05, 2026 |
| 4 | [x] Yes | [x] Yes | Oct 05, 2026 |
| 5 | [ ] | [ ] | Pending |
| 6 | [ ] | [ ] | Pending |
| 7 | [ ] | [ ] | Pending |
| 8 | [ ] | [ ] | Pending |
| 9 | [ ] | [ ] | Pending |
| 10 | [ ] | [ ] | Pending |
