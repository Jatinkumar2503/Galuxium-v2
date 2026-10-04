'use server';

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validatePassword } from '@/lib/auth/password-policy';
import { checkLoginRateLimit, recordFailedLoginAttempt, clearFailedLoginAttempts } from '@/lib/auth/lockout';

export interface AuthActionResponse {
  success: boolean;
  error?: string;
  isLocked?: boolean;
  lockDurationMinutes?: number;
  requiresChallenge?: boolean;
}

/**
 * Signs in a user with email and password.
 * Protected by custom brute-force lockout layer and non-leaking errors.
 */
export async function signInAction(
  formData: FormData,
  clientIp = '127.0.0.1'
): Promise<AuthActionResponse> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const turnstileToken = formData.get('turnstileToken') as string | undefined;

  if (!email || !password) {
    return {
      success: false,
      error: 'Invalid email or password.',
    };
  }

  // 1. Check custom lockout layer (Instruction 3.5)
  const rateLimitStatus = await checkLoginRateLimit(email, clientIp);
  if (rateLimitStatus.isLocked) {
    return {
      success: false,
      isLocked: true,
      lockDurationMinutes: rateLimitStatus.lockDurationMinutes,
      error: `Account temporarily locked due to excessive failed attempts. Please retry in ${rateLimitStatus.lockDurationMinutes} minute(s).`,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Record failed attempt in custom table
    const failedStatus = await recordFailedLoginAttempt(email, clientIp);

    if (failedStatus.isLocked) {
      return {
        success: false,
        isLocked: true,
        lockDurationMinutes: failedStatus.lockDurationMinutes,
        error: `Account temporarily locked due to excessive failed attempts. Please retry in ${failedStatus.lockDurationMinutes} minute(s).`,
      };
    }

    // Non-leaking error message
    return {
      success: false,
      requiresChallenge: failedStatus.consecutiveFailures >= 3,
      error: 'Invalid email or password.',
    };
  }

  // Clear failed attempts counter on successful login
  await clearFailedLoginAttempts(email, clientIp);

  redirect('/dashboard');
}

/**
 * Initiates password recovery.
 * Guaranteed to prevent user enumeration by returning identical success responses.
 */
export async function forgotPasswordAction(email: string): Promise<AuthActionResponse> {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const supabase = await createServerSupabaseClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`;

  await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });

  // Non-leaking response regardless of whether email exists in database
  return {
    success: true,
    error: undefined,
  };
}

/**
 * Resets user password after token verification.
 */
export async function resetPasswordAction(newPassword: string): Promise<AuthActionResponse> {
  const validation = validatePassword(newPassword);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return {
      success: false,
      error: 'Unable to update password. Your reset link may have expired.',
    };
  }

  redirect('/auth/login?notice=Password%20successfully%20updated.');
}

/**
 * Signs out current user session.
 */
export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}
