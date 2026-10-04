import { createClient } from '@supabase/supabase-js';

/**
 * Creates an administrative Supabase client bypassing RLS using the SUPABASE_SERVICE_ROLE_KEY.
 * MUST only be invoked from secure server-side environments (e.g. audit logging, webhooks, rate limiting).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing admin Supabase keys: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
