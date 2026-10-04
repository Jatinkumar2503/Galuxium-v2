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
- **Instruction 3.5 (Auth Security):** Supabase Auth lacks native progressive account lockout. Implemented via custom `auth_failed_attempts` table checked before authentication with progressive backoff (1m, 5m, 15m) and Cloudflare Turnstile challenge.
- **Design Tokens:** Strict WCAG 2.1 AA compliance: `#B08D57` and `#C98A2B` are never used for body or regular UI text against `#F7F4EE`.
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
- [x] 2.6 Create the append-only `audit_log` trigger (block UPDATE and DELETE).
- [x] 2.7 Add a duplicate-detection hash column and unique constraint on `documents`.
- [x] 2.8 Write a seed script producing two demo orgs plus one accountant managing both.
- [x] 2.9 Write automated RLS tests: user from Org A must never read or write Org B data.
- [x] 2.10 Generate TypeScript types from the schema and add an ER diagram to `docs/`.

**Exit Gate:** the RLS test suite passes in CI. Attempting cross-tenant reads through the API returns nothing. Audit log rejects edits. — **PASSED (Verified Oct 05, 2026)**

---

## PHASE 3: Authentication and Session Security (10/10 Complete)
*Goal: secure sign-in with Google and email/password, with login limits.*

- [x] 3.1 Enable Google OAuth (Supabase Auth) with a correctly configured consent screen and exact redirect URIs for local, preview, and production.
- [x] 3.2 Enable email + password sign-up with email verification required before access.
- [x] 3.3 Enforce password policy: minimum 12 characters, check against a breached-password list, no composition gimmicks.
- [x] 3.4 Build sign-up, login, logout, forgot-password, and reset-password flows with clear, non-leaking error messages ("Invalid email or password").
- [x] 3.5 Login rate limiting: max 5 failed attempts per account + IP per 15 minutes, then progressive lockout (1 min, 5 min, 15 min), plus a bot challenge (e.g., Turnstile) after 3 failures. Add a separate IP-level limit on sign-up and reset requests.
- [x] 3.6 Use secure session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`; short-lived access token with refresh rotation.
- [x] 3.7 Account linking: the same verified email via Google and password resolves to one account, never two.
- [x] 3.8 Route protection: middleware guards all app routes; role checks happen on the server, never only in the UI.
- [x] 3.9 Log auth events (login, failure, lockout, password change, new device) to the audit log, and show "recent activity" to the user.
- [x] 3.10 Optional but recommended: TOTP two-factor authentication for owner and accountant roles; add a "sign out of all devices" button.

**Exit Gate:** you can register by Google and by email, verify, log in, log out, and reset a password. Six wrong passwords trigger lockout. An unauthenticated request to any protected route is rejected. — **PASSED (Verified Oct 05, 2026)**

---

## Progress Overview
- [x] Phase 1: Foundation and Project Setup (10/10) — Signed Off
- [x] Phase 2: Database, Multi-Tenancy, and Row-Level Security (10/10) — Signed Off
- [x] Phase 3: Authentication and Session Security (10/10) — Signed Off
- [ ] Phase 4: Design System and 3D Frontend Shell (0/10)
- [ ] Phase 5: Document Ingestion and Storage (0/10)
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
| 4 | [ ] | [ ] | Pending |
| 5 | [ ] | [ ] | Pending |
| 6 | [ ] | [ ] | Pending |
| 7 | [ ] | [ ] | Pending |
| 8 | [ ] | [ ] | Pending |
| 9 | [ ] | [ ] | Pending |
| 10 | [ ] | [ ] | Pending |
