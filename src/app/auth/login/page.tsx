'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { signInAction } from '@/lib/auth/server-actions';
import { ShieldCheck, Lock, Mail, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutNotice, setLockoutNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLockoutNotice(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signInAction(formData);

    if (!result.success) {
      if (result.isLocked) {
        setLockoutNotice(result.error || 'Account temporarily locked.');
      } else {
        setErrorMessage(result.error || 'Invalid email or password.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-warm-bg text-warm-charcoal">
      <div className="max-w-md w-full p-8 rounded-2xl border border-warm-sand bg-warm-surface/90 backdrop-blur shadow-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-accent shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-warm-charcoal">
            Sign In to Galuxium Nexus
          </h1>
          <p className="text-xs text-warm-taupe">
            Autonomous GST Invoice Reconciliation for Indian Enterprises
          </p>
        </div>

        {lockoutNotice && (
          <div className="p-3.5 rounded-lg border border-warm-amber bg-warm-cream text-xs text-warm-charcoal flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-warm-amber shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warm-charcoal">Security Lockout Active</p>
              <p className="text-warm-taupe">{lockoutNotice}</p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg border border-warm-terracotta/40 bg-warm-cream text-xs text-warm-terracotta text-center font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-warm-charcoal uppercase tracking-wider">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-warm-taupe absolute left-3 top-3.5" />
              <input
                type="email"
                name="email"
                required
                placeholder="ca.sharma@nexusadvisory.in"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-warm-sand bg-warm-cream text-warm-charcoal text-sm placeholder:text-warm-taupe/60 focus:outline-none focus:ring-2 focus:ring-warm-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-warm-charcoal uppercase tracking-wider">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-xs text-warm-bronze hover:underline font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-warm-taupe absolute left-3 top-3.5" />
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-warm-sand bg-warm-cream text-warm-charcoal text-sm placeholder:text-warm-taupe/60 focus:outline-none focus:ring-2 focus:ring-warm-accent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-warm-accent hover:bg-warm-accent/90 text-warm-bg font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-warm-accent disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-warm-sand w-full" />
          <span className="bg-warm-surface px-3 text-xs text-warm-taupe uppercase tracking-wider">
            Or
          </span>
        </div>

        <GoogleAuthButton label="Sign In with Google" />

        <div className="text-center pt-2">
          <p className="text-xs text-warm-taupe">
            Don&apos;t have an organization workspace?{' '}
            <Link href="/auth/register" className="text-warm-bronze hover:underline font-semibold">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
