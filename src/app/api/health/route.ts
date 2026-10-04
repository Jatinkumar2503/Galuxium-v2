import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();

  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = Math.floor(process.uptime());

  const healthData = {
    status: 'healthy',
    service: 'galuxium-nexus-v2',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    environment: process.env.NODE_ENV || 'development',
    region: process.env.VERCEL_REGION || 'bom1',
    checks: {
      api: 'healthy',
      database: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'mock-fallback',
      storage: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'mock-fallback',
    },
    system: {
      memoryRssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      memoryHeapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    },
    latencyMs: Date.now() - startTime,
  };

  return NextResponse.json(healthData, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json',
    },
  });
}
