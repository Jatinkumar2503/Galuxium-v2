'use client';

import React from 'react';
import { ShieldCheck, AlertCircle, Lock, Smartphone, ShieldAlert } from 'lucide-react';
import { SecurityActivityItem } from '@/lib/audit/auth-logger';

interface RecentActivityFeedProps {
  activities: SecurityActivityItem[];
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  const getActionDetails = (action: string) => {
    switch (action) {
      case 'auth.login_success':
        return {
          label: 'Successful Sign In',
          icon: <ShieldCheck className="w-4 h-4 text-warm-bronze" />,
          badgeBg: 'bg-warm-surface border-warm-sand text-warm-charcoal',
        };
      case 'auth.login_failure':
        return {
          label: 'Failed Sign-In Attempt',
          icon: <AlertCircle className="w-4 h-4 text-warm-terracotta" />,
          badgeBg: 'bg-warm-surface border-warm-terracotta/30 text-warm-terracotta',
        };
      case 'auth.lockout_triggered':
        return {
          label: 'Progressive Lockout Enforced',
          icon: <ShieldAlert className="w-4 h-4 text-warm-amber" />,
          badgeBg: 'bg-warm-surface border-warm-amber/40 text-warm-charcoal',
        };
      case 'auth.password_changed':
        return {
          label: 'Password Changed',
          icon: <Lock className="w-4 h-4 text-warm-accent" />,
          badgeBg: 'bg-warm-surface border-warm-sand text-warm-charcoal',
        };
      default:
        return {
          label: 'Session Activity',
          icon: <Smartphone className="w-4 h-4 text-warm-taupe" />,
          badgeBg: 'bg-warm-surface border-warm-sand text-warm-charcoal',
        };
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-warm-sand bg-warm-cream/50 text-center text-xs text-warm-taupe">
        No recent authentication events recorded in this billing cycle.
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl border border-warm-sand bg-warm-surface shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-warm-sand pb-3">
        <div>
          <h2 className="text-base font-serif font-bold text-warm-charcoal">
            Recent Security Activity
          </h2>
          <p className="text-xs text-warm-taupe">
            Append-only audit trail of session logins, lockouts, and credential updates
          </p>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-warm-cream border border-warm-sand text-warm-taupe">
          Immutable SHA-256 Ledger
        </span>
      </div>

      <div className="divide-y divide-warm-sand/60">
        {activities.map((item) => {
          const { label, icon, badgeBg } = getActionDetails(item.action);
          return (
            <div key={item.id} className="py-3 flex items-start justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-md bg-warm-cream border border-warm-sand">
                  {icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-warm-charcoal">{label}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${badgeBg}`}>
                      {item.action}
                    </span>
                  </div>
                  <p className="text-[11px] text-warm-taupe pt-0.5">
                    IP: {item.ipAddress || '127.0.0.1'} • {item.userAgent || 'Web Browser'}
                  </p>
                </div>
              </div>
              <time className="text-[11px] text-warm-taupe shrink-0">
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
          );
        })}
      </div>
    </div>
  );
}
