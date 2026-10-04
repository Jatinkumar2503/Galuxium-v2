'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getOAuthRedirectUrl } from '@/lib/auth/oauth';

export interface SignUpResult {
  success: boolean;
  requiresEmailVerification?: boolean;
  error?: string;
}

/**
 * Signs up a new user with email and password.
 * Strictly requires email verification before granting dashboard access.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<SignUpResult> {
  const supabase = await createServerSupabaseClient();
  const emailRedirectTo = getOAuthRedirectUrl('/dashboard');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo,
    },
  });

  if (error) {
    return {
      success: false,
      error: error.message || 'Unable to complete registration. Please try again.',
    };
  }

  // If user is returned without active session, email verification is pending
  const requiresVerification = !data.session && Boolean(data.user);

  return {
    success: true,
    requiresEmailVerification: requiresVerification,
  };
}
