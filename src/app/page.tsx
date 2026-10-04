import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  FileCheck2,
  Lock,
  Layers,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: HERO OVERVIEW                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-24 text-center relative">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-warm-sand bg-warm-surface/80 backdrop-blur text-xs font-semibold text-warm-charcoal uppercase tracking-wider shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-warm-accent" />
            Galuxium Nexus V2 • Autonomous GST Reconciliation Engine
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif font-bold tracking-tight text-warm-charcoal leading-tight">
            Autonomous Invoice Reconciliation for Indian Enterprises
          </h1>

          <p className="text-base sm:text-xl text-warm-taupe max-w-2xl mx-auto leading-relaxed">
            Eliminate blocked Input Tax Credit (ITC) and manual matching friction. Galuxium pairs multimodal vision extraction with deterministic GST auditing and cryptographic audit integrity.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-warm-accent hover:bg-warm-accent/90 text-warm-bg font-semibold text-sm transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-warm-accent"
            >
              Launch Workspace
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal font-semibold text-sm transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-warm-accent"
            >
              Client Sign In
            </Link>
          </div>

          {/* Metric Highlights (Charcoal / Bronze - WCAG AA) */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface/80 backdrop-blur shadow-sm">
              <p className="text-2xl font-serif font-bold text-warm-charcoal">99.4%</p>
              <p className="text-xs text-warm-taupe pt-1">Extraction Precision</p>
            </div>
            <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface/80 backdrop-blur shadow-sm">
              <p className="text-2xl font-serif font-bold text-warm-charcoal">&lt; 3s</p>
              <p className="text-xs text-warm-taupe pt-1">Invoice Matching</p>
            </div>
            <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface/80 backdrop-blur shadow-sm">
              <p className="text-2xl font-serif font-bold text-warm-charcoal">₹ 0</p>
              <p className="text-xs text-warm-taupe pt-1">ITC Cash Leakage</p>
            </div>
            <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface/80 backdrop-blur shadow-sm">
              <p className="text-2xl font-serif font-bold text-warm-charcoal">SHA-256</p>
              <p className="text-xs text-warm-taupe pt-1">Tamper-Proof Ledger</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: THREE-WAY RECONCILIATION ENGINE                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="min-h-screen flex items-center px-6 py-28 relative">
        <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-warm-sand bg-warm-surface text-xs font-semibold text-warm-charcoal">
              <Layers className="w-3.5 h-3.5 text-warm-accent" />
              Tripartite Reconciliation Matrix
            </div>

            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-warm-charcoal">
              Reconcile Vendor Invoices Against Bank Debits and GSTR-2B
            </h2>

            <p className="text-sm sm:text-base text-warm-taupe leading-relaxed">
              Discrepancies between physical bills, accounting entries, and GST portal filings cost Indian SMEs lakhs in disallowed Input Tax Credit. Galuxium executes continuous three-way validation:
            </p>

            <ul className="space-y-3 text-sm text-warm-charcoal">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-warm-bronze shrink-0 mt-0.5" />
                <span><strong>Deterministic GST Validation:</strong> Verifies 15-character GSTIN checksums, state code boundaries, and tax arithmetic.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-warm-bronze shrink-0 mt-0.5" />
                <span><strong>Fuzzy Phonetic Heuristics:</strong> Reconciles supplier trade names with bank statement narrations and UTR references.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-warm-bronze shrink-0 mt-0.5" />
                <span><strong>Section 16(2) Compliance:</strong> Proactively flags supplier non-filing before GSTR-3B tax return deadlines.</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl border border-warm-sand bg-warm-surface/90 backdrop-blur shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-warm-sand pb-3">
              <span className="text-xs font-serif font-bold text-warm-charcoal">
                Live Reconciliation Sample
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-warm-cream border border-warm-sand text-warm-bronze">
                ✓ Auto-Matched 99.8%
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-warm-cream border border-warm-sand space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-warm-charcoal">Siemens India Sensors</span>
                  <span className="font-mono text-warm-charcoal">₹ 1,18,000.00</span>
                </div>
                <p className="text-[11px] text-warm-taupe">INV-2026-BEL-091 • GSTIN 27AAACS1234F1Z9</p>
              </div>

              <div className="p-3 rounded-lg bg-warm-cream border border-warm-sand space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-warm-charcoal">HDFC Bank Debit (NEFT)</span>
                  <span className="font-mono text-warm-charcoal">₹ 1,18,000.00</span>
                </div>
                <p className="text-[11px] text-warm-taupe">UTR: HDFC000123456789 • Value Date: 02 Oct</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3: CRYPTOGRAPHIC AUDIT LEDGER                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="min-h-screen flex items-center px-6 py-28 relative">
        <div className="max-w-4xl mx-auto w-full text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-warm-sand bg-warm-surface text-xs font-semibold text-warm-charcoal">
            <Lock className="w-3.5 h-3.5 text-warm-accent" />
            Demonstrable Statutory Governance
          </div>

          <h2 className="text-3xl sm:text-5xl font-serif font-bold text-warm-charcoal">
            Immutable Cryptographic Audit Trail
          </h2>

          <p className="text-base sm:text-lg text-warm-taupe max-w-2xl mx-auto leading-relaxed">
            Every invoice upload, tax rate extraction, and matching decision is linked into a SHA-256 hash chain with PostgreSQL transaction-level advisory locks. Tampering is mathematically detectable.
          </p>

          <div className="p-6 rounded-2xl border border-warm-sand bg-warm-surface/90 backdrop-blur shadow-md max-w-2xl mx-auto text-left space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-warm-sand">
              <span className="text-warm-taupe text-[11px]">Ledger Chain Status</span>
              <span className="text-warm-bronze font-semibold">✓ Cryptographically Verified</span>
            </div>
            <p className="text-warm-taupe truncate">Genesis: 0000000000000000000000000000000000000000000000000000000000000000</p>
            <p className="text-warm-charcoal truncate">Block #1: 7f864f8a9db3... [document_uploaded]</p>
            <p className="text-warm-charcoal truncate">Block #2: 4a74b4c74c62... [gst_validation_passed]</p>
            <p className="text-warm-accent truncate">Head #3: e3b0c44298fc... [reconciliation_approved]</p>
          </div>

          <div className="pt-4">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-warm-accent hover:bg-warm-accent/90 text-warm-bg font-semibold text-sm transition-colors shadow-sm"
            >
              Get Started with Galuxium
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
