import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('--- Galuxium Nexus V2 Code Quality Gate ---');

try {
  console.log('1. Checking strict TypeScript types...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✓ TypeScript checks passed.');
} catch (e) {
  console.error('❌ TypeScript check failed.');
  process.exit(1);
}

console.log('✓ All pre-commit quality gates passed.');
