'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { signUpWithEmail } from '@/lib/auth/email-auth';
import { validatePassword } from '@/lib/auth/password-policy';
import { UserPlus, User, Mail, Lock } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Client-side password validation check
    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError(validation.error || 'Password does not meet security criteria.');
      return;
    }

    setLoading(true);
    const result = await signUpWithEmail(email, password, fullName);

    if (!result.success) {
      setError(result.error || 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    if (result.requiresEmailVerification) {
      router.push('/auth/verify-email');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-warm-bg text-warm-charcoal">
      <div className="max-w-md w-full p-8 rounded-2xl border border-warm-sand bg-warm-surface/90 backdrop-blur shadow-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-accent shadow-sm">
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-warm-charcoal">
            Create Nexus Workspace
          </h1>
          <p className="text-xs text-warm-taupe">
            Join thousands of Indian businesses reconciling invoices autonomously
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-warm-terracotta/40 bg-warm-cream text-xs text-warm-terracotta text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-warm-charcoal uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-warm-taupe absolute left-3 top-3.5" />
              <input
                type="text"
                name="fullName"
                required
                placeholder="Aarav Mehta"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-warm-sand bg-warm-cream text-warm-charcoal text-sm placeholder:text-warm-taupe/60 focus:outline-none focus:ring-2 focus:ring-warm-accent"
              />
            </div>
          </div>

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
                placeholder="aarav@bharatelectronics.in"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-warm-sand bg-warm-cream text-warm-charcoal text-sm placeholder:text-warm-taupe/60 focus:outline-none focus:ring-2 focus:ring-warm-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-warm-charcoal uppercase tracking-wider">
              Password (Min 8 Characters)
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
            <p className="text-[11px] text-warm-taupe">
              Passphrases like &quot;correct horse battery staple&quot; are recommended.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-warm-accent hover:bg-warm-accent/90 text-warm-bg font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-warm-accent disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Register Workspace'}
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-warm-sand w-full" />
          <span className="bg-warm-surface px-3 text-xs text-warm-taupe uppercase tracking-wider">
            Or
          </span>
        </div>

        <GoogleAuthButton label="Sign Up with Google" />

        <div className="text-center pt-2">
          <p className="text-xs text-warm-taupe">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-warm-bronze hover:underline font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
