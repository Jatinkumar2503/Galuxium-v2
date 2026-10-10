import { Inngest } from 'inngest';

/**
 * Inngest client for Galuxium Nexus background extraction pipeline.
 * Adheres strictly to zero-secret rules: reads keys solely via process.env.
 */
export const inngest = new Inngest({
  id: 'galuxium-nexus',
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
