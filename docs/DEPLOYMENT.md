# Galuxium Nexus V2: Deployment & Preview Architecture

## Deployment Strategy
Galuxium Nexus V2 utilizes Vercel's Edge and Serverless Network with the primary deployment region pinned to `bom1` (Mumbai, India) to maintain single-digit millisecond latency to Indian tax portals and domestic banking webhooks.

## Branch Workflow & Preview URLs
In accordance with Rule 4 ("`main` is always deployable. Work on branches, merge only when the gate item passes"):
- Every push to any branch (e.g. `phase-1-foundation`, `feat-*`) automatically triggers an isolated Vercel Preview Deployment.
- Preview URLs follow the deterministic pattern: `galuxium-nexus-v2-git-<branch>-<user>.vercel.app`.
- Preview deployments inherit preview-scoped Supabase environments to prevent contamination of production ledgers.

## Production Deployment Checklist
1. All 10 instructions in the active phase marked `[x]` with passing tests.
2. Exit Gate verification script executed cleanly.
3. GitHub Actions CI status is green.
4. Merge commit landing on `main` triggers zero-downtime production deployment to `galuxium-nexus-v2.vercel.app`.
