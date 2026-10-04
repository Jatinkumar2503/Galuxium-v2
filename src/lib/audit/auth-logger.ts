import { createAdminClient } from '@/lib/supabase/admin';

export type AuthSecurityAction =
  | 'auth.login_success'
  | 'auth.login_failure'
  | 'auth.lockout_triggered'
  | 'auth.password_changed'
  | 'auth.new_device_detected';

export interface LogAuthEventParams {
  orgId: string;
  actorId?: string;
  action: AuthSecurityAction;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export interface SecurityActivityItem {
  id: number;
  action: string;
  entityType: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * Logs authentication and session security events directly into the append-only audit_log table.
 * Automatically chained cryptographically via the PostgreSQL SHA-256 trigger.
 */
export async function logAuthSecurityEvent(params: LogAuthEventParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      org_id: params.orgId,
      actor_id: params.actorId || null,
      action: params.action,
      entity_type: 'auth_session',
      entity_id: params.actorId || params.ipAddress || 'anonymous',
      details: params.details || {},
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });
  } catch (err) {
    // Fail safe to prevent auth blocking if audit fails in development
    console.error('[Audit Log Error]', err);
  }
}

/**
 * Fetches recent security activity for display on the user settings / dashboard.
 */
export async function fetchRecentSecurityActivity(
  orgId: string,
  limit = 10
): Promise<SecurityActivityItem[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('audit_log')
      .select('id, action, entity_type, details, ip_address, user_agent, created_at')
      .eq('org_id', orgId)
      .like('action', 'auth.%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as SecurityActivityItem[];
  } catch {
    return [];
  }
}
