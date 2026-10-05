import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  let dbStatus = 'disconnected';
  let dbLatencyMs: number | null = null;
  let isDbHealthy = false;

  try {
    const dbStartTime = Date.now();
    const supabase = createAdminClient();
    
    // Executes a real live query on the PostgreSQL database
    const { error, status } = await supabase
      .from('organizations')
      .select('id', { count: 'exact', head: true });

    dbLatencyMs = Date.now() - dbStartTime;

    if (!error && status >= 200 && status < 300) {
      dbStatus = 'connected';
      isDbHealthy = true;
    } else {
      dbStatus = `error: ${error?.message || `HTTP ${status}`}`;
    }
  } catch (err: unknown) {
    dbStatus = `error: ${err instanceof Error ? err.message : 'Database query failed'}`;
  }

  const overallStatus = isDbHealthy ? 'healthy' : 'degraded';

  const healthData = {
    status: overallStatus,
    service: 'galuxium-nexus-v2',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'bom1',
    checks: {
      api: 'healthy',
      database: dbStatus,
      databaseLatencyMs: dbLatencyMs,
    },
    system: {
      memoryRssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      memoryHeapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    },
    latencyMs: Date.now() - startTime,
  };

  return NextResponse.json(healthData, {
    status: isDbHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json',
    },
  });
}
