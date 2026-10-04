import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center relative overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-warm-cream via-warm-bg to-warm-bg" />

      <div className="relative z-10 max-w-4xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-warm-sand bg-warm-surface/80 backdrop-blur text-xs font-medium text-warm-taupe uppercase tracking-wider shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-warm-accent" />
          Galuxium Nexus V2 • Autonomous GST Reconciliation
        </div>

        <h1 className="text-4xl sm:text-6xl font-serif font-bold tracking-tight text-warm-charcoal">
          Intelligent Invoice Audit &amp; Reconciliation for Indian SMEs
        </h1>

        <p className="text-lg sm:text-xl text-warm-taupe max-w-2xl mx-auto leading-relaxed">
          Reconcile supplier tax invoices against bank statements and GSTR-2B filing returns autonomously with multimodal AI and cryptographic audit integrity.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/auth/register"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-warm-accent text-warm-bg font-medium hover:bg-warm-accent/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-warm-accent focus:ring-offset-2 focus:ring-offset-warm-bg"
          >
            Launch Nexus Workspace
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-warm-accent"
          >
            <ShieldCheck className="w-4 h-4 text-warm-bronze" />
            Compliance Architecture
          </Link>
        </div>
      </div>
    </main>
  );
}
