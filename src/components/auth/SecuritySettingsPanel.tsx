'use client';

import React, { useState } from 'react';
import { enrollTotpFactor, verifyTotpEnrollment, signOutAllDevices } from '@/lib/auth/totp-actions';
import { ShieldCheck, LogOut, KeyRound, CheckCircle2 } from 'lucide-react';

export function SecuritySettingsPanel() {
  const [enrolling, setEnrolling] = useState(false);
  const [totpData, setTotpData] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [enrolledSuccess, setEnrolledSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalSignOutLoading, setGlobalSignOutLoading] = useState(false);

  const handleStart2FA = async () => {
    setError(null);
    setEnrolling(true);
    const res = await enrollTotpFactor();
    setEnrolling(false);

    if (res.success && res.factorId && res.qrCode && res.secret) {
      setTotpData({
        factorId: res.factorId,
        qrCode: res.qrCode,
        secret: res.secret,
      });
    } else {
      setError(res.error || 'Unable to start 2FA enrollment.');
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpData) return;
    setError(null);

    const res = await verifyTotpEnrollment(totpData.factorId, verificationCode);
    if (res.success) {
      setEnrolledSuccess(true);
      setTotpData(null);
    } else {
      setError(res.error || 'Invalid 6-digit code.');
    }
  };

  const handleSignOutAll = async () => {
    setGlobalSignOutLoading(true);
    await signOutAllDevices();
  };

  return (
    <div className="p-6 rounded-2xl border border-warm-sand bg-warm-surface shadow-sm space-y-6">
      <div className="border-b border-warm-sand pb-4">
        <h2 className="text-lg font-serif font-bold text-warm-charcoal">
          Two-Factor Authentication &amp; Device Sessions
        </h2>
        <p className="text-xs text-warm-taupe">
          Manage hardware-backed TOTP security and active session tokens
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-warm-terracotta/40 bg-warm-cream text-xs text-warm-terracotta">
          {error}
        </div>
      )}

      {enrolledSuccess && (
        <div className="p-4 rounded-lg bg-warm-cream border border-warm-sand text-xs text-warm-charcoal flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-warm-bronze shrink-0" />
          <div>
            <p className="font-semibold">Two-Factor Authentication Active</p>
            <p className="text-warm-taupe">
              Your account is now secured with TOTP authenticator protection.
            </p>
          </div>
        </div>
      )}

      {/* TOTP Enrollment Section */}
      {!enrolledSuccess && !totpData && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-warm-sand bg-warm-cream/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-warm-accent" />
              <span className="text-sm font-semibold text-warm-charcoal">
                TOTP Authenticator App (Google / Microsoft / 1Password)
              </span>
            </div>
            <p className="text-xs text-warm-taupe">
              Require a 6-digit one-time code on every login for Owner and Accountant roles.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStart2FA}
            disabled={enrolling}
            className="px-4 py-2 rounded-lg bg-warm-accent hover:bg-warm-accent/90 text-warm-bg text-xs font-semibold transition-colors shrink-0 shadow-sm"
          >
            {enrolling ? 'Initiating...' : 'Enable 2FA'}
          </button>
        </div>
      )}

      {totpData && (
        <form onSubmit={handleVerify2FA} className="p-4 rounded-xl border border-warm-sand bg-warm-cream space-y-4">
          <p className="text-xs font-semibold text-warm-charcoal">
            1. Scan this QR code in your Authenticator app:
          </p>
          <div className="p-3 bg-white w-fit rounded-lg border border-warm-sand">
            {/* Render QR code */}
            <img src={totpData.qrCode} alt="TOTP QR Code" className="w-36 h-36" />
          </div>
          <p className="text-[11px] text-warm-taupe font-mono">
            Secret Key: {totpData.secret}
          </p>

          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-semibold text-warm-charcoal">
              2. Enter the 6-digit code shown in your app:
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              className="w-40 px-3 py-2 rounded-lg border border-warm-sand bg-warm-surface text-warm-charcoal text-center tracking-widest text-base font-mono focus:outline-none focus:ring-2 focus:ring-warm-accent"
              required
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-warm-accent text-warm-bg text-xs font-medium hover:bg-warm-accent/90 transition-colors"
          >
            Verify &amp; Activate 2FA
          </button>
        </form>
      )}

      {/* Global Sign Out Button */}
      <div className="pt-4 border-t border-warm-sand flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-sm font-semibold text-warm-charcoal">
            Active Device Sessions
          </span>
          <p className="text-xs text-warm-taupe">
            Invalidate all active refresh tokens and sign out of all laptops, phones, and browsers.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOutAll}
          disabled={globalSignOutLoading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-warm-terracotta/40 bg-warm-cream hover:bg-warm-terracotta/10 text-warm-terracotta text-xs font-semibold transition-colors shrink-0 shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          {globalSignOutLoading ? 'Signing Out...' : 'Sign Out of All Devices'}
        </button>
      </div>
    </div>
  );
}
