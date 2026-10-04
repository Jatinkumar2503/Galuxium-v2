import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('Project configuration and foundation smoke tests', async (t) => {
  await t.test('package.json exists and has valid scripts', () => {
    assert.equal(existsSync('package.json'), true);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.equal(pkg.name, 'galuxium-nexus-v2');
    assert.ok(pkg.scripts.build);
    assert.ok(pkg.scripts.typecheck);
  });

  await t.test('Warm neutral palette configuration strictly forbids blue and green', () => {
    const tailwindConfig = readFileSync('tailwind.config.ts', 'utf8');
    assert.match(tailwindConfig, /warm:/);
    assert.match(tailwindConfig, /#F7F4EE/);
    assert.match(tailwindConfig, /#B08D57/); // Antique gold
    assert.match(tailwindConfig, /#8A6A3B/); // Deep bronze
    assert.doesNotMatch(tailwindConfig, /blue-/i);
    assert.doesNotMatch(tailwindConfig, /green-/i);
  });

  await t.test('Vercel configuration specifies Mumbai bom1 region', () => {
    assert.equal(existsSync('vercel.json'), true);
    const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf8'));
    assert.deepEqual(vercelConfig.regions, ['bom1']);
  });
});
