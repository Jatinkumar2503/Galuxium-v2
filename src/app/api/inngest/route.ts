import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { extractDocument } from '@/lib/inngest/functions/extract-document';

/**
 * Inngest API serve endpoint for Vercel serverless / Edge execution.
 * Handles background job scheduling, step retries, and webhook event ingestion.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [extractDocument],
});
