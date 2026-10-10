import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';
import { SecurityActivityItem } from '@/lib/audit/auth-logger';
import { 
  Building2, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowUpRight,
  LogOut
} from 'lucide-react';

import { DashboardIngestionSection } from '@/components/dashboard/DashboardIngestionSection';
import { LiveDocumentsLedger } from '@/components/dashboard/LiveDocumentsLedger';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch active org membership or auto-assign to Bharat Electronics demo org
  let orgId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if (user) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membership?.org_id) {
      orgId = membership.org_id;
    } else {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const admin = createAdminClient();
        await admin.from('memberships').upsert({
          org_id: orgId,
          user_id: user.id,
          role: 'owner',
        });
      } catch (err) {
        console.warn('Could not auto-provision demo membership:', err);
      }
    }
  }

  // Mock sample activity items for initial workspace presentation
  const mockActivities: SecurityActivityItem[] = [
    {
      id: 1,
      action: 'auth.login_success',
      entityType: 'auth_session',
      details: { method: user ? 'authenticated_session' : 'sandbox_preview' },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      action: 'auth.new_device_detected',
      entityType: 'device',
      details: { browser: 'Chrome Desktop', location: 'Mumbai, IN' },
      ipAddress: '103.21.124.5',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  return (
    <div className="min-h-screen bg-warm-bg text-warm-charcoal flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-warm-sand bg-warm-surface/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-accent font-serif font-bold text-base shadow-sm">
                G
              </div>
              <span className="font-serif font-bold text-lg text-warm-charcoal tracking-tight">
                Galuxium <span className="text-warm-accent font-sans text-xs uppercase tracking-widest ml-1 font-semibold">Nexus</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-warm-sand bg-warm-cream/60 text-xs">
              <Building2 className="w-3.5 h-3.5 text-warm-taupe" />
              <span className="font-medium text-warm-charcoal">Bharat Electronics Pvt Ltd</span>
              <span className="text-warm-taupe ml-1">· 27AABCU9603R1ZM</span>
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-sand text-warm-accent">
                PRO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-warm-charcoal">
                {user?.user_metadata?.full_name || user?.email || 'Demo Workspace User'}
              </p>
              <p className="text-[10px] text-warm-taupe">Owner · All Permissions</p>
            </div>

            <form action="/auth/callback">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal text-xs font-medium transition-colors shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5 text-warm-taupe" />
                <span>Sign Out</span>
              </Link>
            </form>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-warm-sand/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-warm-charcoal">
              Reconciliation Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-warm-taupe mt-1">
              Autonomous AI match engine and GST compliance overview for October 2026.
            </p>
          </div>

          <DashboardIngestionSection orgId={orgId} />
        </div>

        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Reconciled */}
          <div className="p-5 rounded-xl border border-warm-sand bg-warm-surface shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs text-warm-taupe">
              <span className="font-medium">Total Matched Volume</span>
              <FileText className="w-4 h-4 text-warm-accent" />
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-warm-charcoal tabular-nums">
                ₹14,85,200
              </p>
              <p className="text-[11px] text-warm-bronze font-medium mt-1 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+12.4% from last period</span>
              </p>
            </div>
          </div>

          {/* Autonomous Match Rate */}
          <div className="p-5 rounded-xl border border-warm-sand bg-warm-surface shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs text-warm-taupe">
              <span className="font-medium">Autonomous Match Rate</span>
              <CheckCircle2 className="w-4 h-4 text-warm-bronze" />
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-warm-charcoal tabular-nums">
                98.4%
              </p>
              <p className="text-[11px] text-warm-taupe font-medium mt-1">
                High confidence (&gt;0.95 score)
              </p>
            </div>
          </div>

          {/* Flagged Discrepancies */}
          <div className="p-5 rounded-xl border border-warm-sand bg-warm-surface shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs text-warm-taupe">
              <span className="font-medium">Flagged Discrepancies</span>
              <AlertTriangle className="w-4 h-4 text-warm-amber" />
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-warm-charcoal tabular-nums">
                3 Items
              </p>
              <p className="text-[11px] text-warm-terracotta font-medium mt-1">
                2 GSTIN mismatch, 1 date outlier
              </p>
            </div>
          </div>

          {/* Pending Review Queue */}
          <div className="p-5 rounded-xl border border-warm-sand bg-warm-surface shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs text-warm-taupe">
              <span className="font-medium">Human Review Queue</span>
              <Clock className="w-4 h-4 text-warm-accent" />
            </div>
            <div>
              <p className="text-2xl font-serif font-bold text-warm-charcoal tabular-nums">
                4 Invoices
              </p>
              <p className="text-[11px] text-warm-taupe font-medium mt-1">
                Estimated review time: 3 mins
              </p>
            </div>
          </div>
        </div>

        {/* Content Columns: Recent Invoices & Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Live Documents Ledger (Phase 6.10) */}
          <div className="lg:col-span-2 flex flex-col">
            <LiveDocumentsLedger orgId={orgId} />
          </div>

          {/* Security & Audit Activity Feed */}
          <div className="space-y-4">
            <RecentActivityFeed activities={mockActivities} />
          </div>
        </div>
      </main>
    </div>
  );
}
