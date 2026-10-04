'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getOAuthRedirectUrl } from '@/lib/auth/oauth';

interface GoogleAuthButtonProps {
  label?: string;
  nextPath?: string;
}

export function GoogleAuthButton({
  label = 'Continue with Google',
  nextPath = '/dashboard',
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const redirectTo = getOAuthRedirectUrl(nextPath);

      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (authError) {
        setError('Google sign-in could not be initiated. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full inline-flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-warm-accent shadow-sm disabled:opacity-50"
      >
        {/* Monochromatic warm SVG icon - No blue/green branding colors per palette rule */}
        <svg className="w-5 h-5 text-warm-charcoal fill-current" viewBox="0 0 24 24">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
        {loading ? 'Connecting to Google...' : label}
      </button>
      {error && <p className="text-xs text-warm-terracotta text-center">{error}</p>}
    </div>
  );
}
