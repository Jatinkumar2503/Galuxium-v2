import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a client-side Supabase client with browser cookie handling.
 * Guaranteed to read only from process.env, never hardcoded.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) must be defined.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
