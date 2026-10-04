'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface TotpEnrollResult {
  success: boolean;
  factorId?: string;
  qrCode?: string;
  secret?: string;
  error?: string;
}

/**
 * Enrolls the authenticated user into Time-Based One-Time Password (TOTP) 2FA.
 * Highly recommended for Owner and Accountant roles.
 */
export async function enrollTotpFactor(): Promise<TotpEnrollResult> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'Galuxium Nexus V2',
  });

  if (error || !data) {
    return {
      success: false,
      error: error?.message || 'Failed to initiate 2FA enrollment.',
    };
  }

  return {
    success: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/**
 * Verifies and activates a pending TOTP enrollment factor with a 6-digit code.
 */
export async function verifyTotpEnrollment(factorId: string, code: string) {
  const supabase = await createServerSupabaseClient();

  const challenge = await supabase.auth.mfa.challenge({
    factorId,
  });

  if (challenge.error) {
    return { success: false, error: challenge.error.message };
  }

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });

  if (verify.error) {
    return { success: false, error: 'Invalid verification code. Please check your authenticator app.' };
  }

  return { success: true };
}

/**
 * Terminates ALL active user sessions across all browsers and devices.
 * Uses global sign-out scope.
 */
export async function signOutAllDevices() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/auth/login?notice=Signed%20out%20of%20all%20devices.');
}
