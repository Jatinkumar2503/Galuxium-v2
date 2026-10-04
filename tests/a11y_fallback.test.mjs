import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('Accessibility & Non-WebGL Fallbacks Verification (4.10)', async (t) => {
  await t.test('1. Non-WebGL static fallback component exists and contains visual motif', () => {
    assert.equal(existsSync('src/components/canvas/StaticCanvasFallback.tsx'), true);
    const code = readFileSync('src/components/canvas/StaticCanvasFallback.tsx', 'utf8');
    assert.match(code, /bg-warm-surface/);
    assert.match(code, /bg-warm-cream/);
    assert.match(code, /bg-warm-accent/);
  });

  await t.test('2. Focus-visible outline is configured strictly in antique gold (#B08D57)', () => {
    const globalsCss = readFileSync('src/app/globals.css', 'utf8');
    assert.match(globalsCss, /\*:focus-visible/);
    assert.match(globalsCss, /var\(--color-warm-accent\)/);
    assert.doesNotMatch(globalsCss, /blue/i);
  });

  await t.test('3. Reduced-motion media query switches off continuous intensive animations', () => {
    const heroScene = readFileSync('src/components/canvas/HeroScene.tsx', 'utf8');
    assert.match(heroScene, /if\s*\(reducedMotion\)\s*return;/);
  });
});
