'use client';

import React, { useState } from 'react';
import { resetPasswordAction } from '@/lib/auth/server-actions';
import { validatePassword } from '@/lib/auth/password-policy';
import { LockKeyhole, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Password does not meet security criteria.');
      return;
    }

    setLoading(true);
    const result = await resetPasswordAction(password);

    if (!result.success) {
      setErrorMessage(result.error || 'Unable to update password.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-warm-bg text-warm-charcoal">
      <div className="max-w-md w-full p-8 rounded-2xl border border-warm-sand bg-warm-surface/90 backdrop-blur shadow-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-accent shadow-sm">
            <LockKeyhole className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-warm-charcoal">
            Set New Password
          </h1>
          <p className="text-xs text-warm-taupe">
            Choose a strong passphrase with at least 8 characters
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg border border-warm-terracotta/40 bg-warm-cream text-xs text-warm-terracotta text-center font-medium">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-warm-charcoal uppercase tracking-wider">
              New Password
            </label>
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

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-warm-charcoal uppercase tracking-wider">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-warm-taupe absolute left-3 top-3.5" />
              <input
                type="password"
                name="confirmPassword"
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
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
