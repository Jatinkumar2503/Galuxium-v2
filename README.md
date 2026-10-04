# Galuxium Nexus V2

> **Autonomous AI Invoice Reconciliation & GST Compliance Engine for Indian SMEs & Accountants**

Built for the Galuxium Nexus Hackathon 2026.

[![CI](https://github.com/Jatinkumar2503/Galuxium-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/Jatinkumar2503/Galuxium-v2/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Design](https://img.shields.io/badge/Design-Warm_Neutrals_Only-B08D57)](ROADMAP.md)

---

## 🏛️ Executive Summary

Indian SMEs and accounting firms face severe operational bottlenecks reconciling vendor tax invoices with bank statements and government GSTR-2B filings. Missing or mismatched invoices lead to blocked Input Tax Credit (ITC), cashflow drag, and statutory tax penalties.

**Galuxium Nexus V2** is an intelligent, autonomous reconciliation and audit platform featuring:
- **Vision-Driven Document Extraction:** High-accuracy extraction across messy invoices, bilingual formats, and thermal receipts.
- **Deterministic GST Auditor:** Validates checksums, tax slabs (0%, 5%, 12%, 18%, 28%), and reverse charge applicability.
- **Explainable Matching Engine:** Three-tier matching (strict deterministic, fuzzy phonetic heuristics, and LLM-assisted ambiguity resolution).
- **Cryptographic Audit Chain:** Tamper-evident SHA-256 hash chains guaranteeing demonstrable compliance.
- **Multi-Tenant Accounting Portal:** Client-level data segregation guarded by PostgreSQL Row-Level Security (RLS).
- **Warm Neutral 3D Spatial Canvas:** Immersive Three.js ambient visual shell adhering to the zero-blue, zero-green design mandate.

---

## 📦 Tech Stack
- **Framework:** Next.js (App Router, React 19)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Vanilla CSS + Tailwind CSS (Warm Neutrals Only)
- **3D Graphics:** React Three Fiber + Drei (Three.js)
- **Database & Auth:** Supabase (PostgreSQL with RLS, Google OAuth, Email/Password)
- **Validation:** Zod v3
- **CI/CD:** GitHub Actions

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/Jatinkumar2503/Galuxium-v2.git
cd Galuxium-v2

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

---

## 📄 License
Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.
