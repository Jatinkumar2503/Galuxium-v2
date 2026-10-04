import React from 'react';
import Link from 'next/link';
import { MailCheck, ArrowLeft } from 'lucide-react';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-warm-bg text-warm-charcoal">
      <div className="max-w-md w-full p-8 rounded-2xl border border-warm-sand bg-warm-surface/90 backdrop-blur shadow-md space-y-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-accent shadow-sm">
          <MailCheck className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-bold text-warm-charcoal">
            Verify Your Email Address
          </h1>
          <p className="text-sm text-warm-taupe leading-relaxed">
            We have sent a secure confirmation link to your email address. You must verify your email before accessing your Galuxium Nexus workspace.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-warm-cream border border-warm-sand text-xs text-warm-taupe text-left space-y-1">
          <p className="font-semibold text-warm-charcoal">Security Notice:</p>
          <p>• The verification link expires in 24 hours.</p>
          <p>• If you don&apos;t see the email, check your spam or promotions folder.</p>
        </div>

        <div className="pt-2">
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-warm-bronze hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
