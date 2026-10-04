'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction } from '@/lib/auth/server-actions';
import { KeyRound, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    const result = await forgotPasswordAction(email);
    setLoading(false);

    if (result.success) {
      setSubmitted(true);
    } else {
      setErrorMessage(result.error || 'Unable to process request.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-warm-bg text-warm-charcoal">
      <div className="max-w-md w-full p-8 rounded-2xl border border-warm-sand bg-warm-surface/90 backdrop-blur shadow-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-accent shadow-sm">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-warm-charcoal">
            Password Recovery
          </h1>
          <p className="text-xs text-warm-taupe">
            Enter your work email to receive password reset instructions
          </p>
        </div>

        {submitted ? (
          <div className="p-4 rounded-lg bg-warm-cream border border-warm-sand text-xs text-warm-charcoal space-y-2 text-center">
            <div className="flex justify-center text-warm-bronze">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="font-semibold text-warm-charcoal">Instructions Dispatched</p>
            <p className="text-warm-taupe leading-relaxed">
              If an account with that email exists, password reset instructions have been sent. For security reasons, we do not confirm whether an account is registered.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg border border-warm-terracotta/40 bg-warm-cream text-xs text-warm-terracotta text-center font-medium">
                {errorMessage}
              </div>
            )}

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
                  placeholder="your.name@company.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-warm-sand bg-warm-cream text-warm-charcoal text-sm placeholder:text-warm-taupe/60 focus:outline-none focus:ring-2 focus:ring-warm-accent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-warm-accent hover:bg-warm-accent/90 text-warm-bg font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-warm-accent disabled:opacity-50"
            >
              {loading ? 'Sending Request...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-xs text-warm-bronze hover:underline font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
