/**
 * Galuxium Nexus V2 Sentry & Error Monitoring Integration
 */

export interface ErrorContext {
  userId?: string;
  orgId?: string;
  route?: string;
  metadata?: Record<string, unknown>;
}

export function captureException(error: unknown, context?: ErrorContext) {
  // If SENTRY_DSN is configured, log with context
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error Captured]', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      hasSentryDsn: Boolean(dsn),
    });
  }

  // When Sentry client is initialized in production, forward context
  if (typeof window !== 'undefined' && (window as unknown as { Sentry?: { captureException: Function } }).Sentry) {
    (window as unknown as { Sentry: { captureException: Function } }).Sentry.captureException(error, {
      extra: context,
    });
  }
}
