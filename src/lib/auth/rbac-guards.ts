import { createServerSupabaseClient } from '@/lib/supabase/server';
import { UserRole } from '@/types/database';

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Insufficient organization permissions') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  orgId: string;
  role: UserRole;
}

/**
 * Server-Side Role Guard (Instruction 3.8)
 * Checks user authentication and verifies organization membership and role directly
 * in the database on the server. Never trusts client-side state.
 */
export async function requireOrgRole(
  orgId: string,
  allowedRoles: UserRole[]
): Promise<AuthenticatedUserContext> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new UnauthorizedError('You must be signed in to perform this action.');
  }

  // Fetch actual role directly from database
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership) {
    throw new ForbiddenError('You are not a member of this organization.');
  }

  const role = membership.role as UserRole;
  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError(
      `Access denied. Role "${role}" lacks permission. Required: [${allowedRoles.join(', ')}]`
    );
  }

  return {
    userId: user.id,
    email: user.email || '',
    orgId,
    role,
  };
}
