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

## Progress Overview
- [x] Phase 1: Foundation and Project Setup (10/10) — Signed Off
- [ ] Phase 2: Database, Multi-Tenancy, and Row-Level Security (0/10)
- [ ] Phase 3: Authentication and Session Security (0/10)
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
| 2 | [ ] | [ ] | Pending |
| 3 | [ ] | [ ] | Pending |
| 4 | [ ] | [ ] | Pending |
| 5 | [ ] | [ ] | Pending |
| 6 | [ ] | [ ] | Pending |
| 7 | [ ] | [ ] | Pending |
| 8 | [ ] | [ ] | Pending |
| 9 | [ ] | [ ] | Pending |
| 10 | [ ] | [ ] | Pending |
