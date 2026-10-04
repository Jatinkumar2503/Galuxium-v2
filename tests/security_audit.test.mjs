import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function getFilesRecursively(dir, fileList = []) {
  if (!readdirSync(dir)) return fileList;
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== '.next') {
        getFilesRecursively(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

test('Security Audit: Zero Service Role Exposure in Client Code', async (t) => {
  const allFiles = getFilesRecursively('src');

  const clientFacingFiles = allFiles.filter(
    (f) =>
      f.includes('src/components') ||
      f.includes('src/lib/supabase/client.ts') ||
      (f.includes('src/app') && !f.includes('/api/'))
  );

  await t.test('SUPABASE_SERVICE_ROLE_KEY is never imported or referenced in client-side code', () => {
    for (const file of clientFacingFiles) {
      const content = readFileSync(file, 'utf8');
      assert.doesNotMatch(
        content,
        /SUPABASE_SERVICE_ROLE_KEY/,
        `Client file ${file} must NEVER reference SUPABASE_SERVICE_ROLE_KEY`
      );
      assert.doesNotMatch(
        content,
        /createAdminClient/,
        `Client file ${file} must NEVER import or invoke createAdminClient`
      );
    }
  });

  await t.test('Service role key is NEVER exposed via NEXT_PUBLIC_ prefix', () => {
    const envExample = readFileSync('.env.example', 'utf8');
    assert.doesNotMatch(
      envExample,
      /NEXT_PUBLIC_.*SERVICE_ROLE/,
      'Service role key must never have NEXT_PUBLIC_ prefix'
    );
  });
});
