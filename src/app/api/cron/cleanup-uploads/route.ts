import { NextRequest, NextResponse } from 'next/server';
import { cleanupAbandonedUploadsAction } from '@/lib/storage/upload-actions';

export const dynamic = 'force-dynamic';

/**
 * Scheduled Cron Endpoint: /api/cron/cleanup-uploads (Section 1.4 & Test 13)
 * Automatically invoked hourly via Vercel Cron or external orchestrator.
 * Deletes storage objects and marks documents as 'rejected' (reason: 'abandoned')
 * for any row still in 'pending_validation' after 1 hour.
 */
export async function GET(req: NextRequest) {
  // Verify Vercel Cron Secret (fail closed in production)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized: invalid or unconfigured CRON_SECRET.' },
        { status: 401 }
      );
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized cron invocation.' },
      { status: 401 }
    );
  }

  try {
    const result = await cleanupAbandonedUploadsAction();

    return NextResponse.json({
      success: true,
      job: 'cleanup_abandoned_uploads',
      cleanedCount: result.cleanedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
