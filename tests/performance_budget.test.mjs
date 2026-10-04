import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';

test('Performance Budget & 3D Optimization Tests (4.9)', async (t) => {
  await t.test('1. Three.js canvas is lazy-loaded with SSR disabled', () => {
    const bgCanvasCode = readFileSync('src/components/canvas/BackgroundCanvas.tsx', 'utf8');
    assert.match(bgCanvasCode, /dynamic\(/);
    assert.match(bgCanvasCode, /ssr:\s*false/);
  });

  await t.test('2. Tab visibility listener is active to pause rendering loop when hidden', () => {
    const bgCanvasCode = readFileSync('src/components/canvas/BackgroundCanvas.tsx', 'utf8');
    assert.match(bgCanvasCode, /visibilitychange/);
    assert.match(bgCanvasCode, /document\.hidden/);
  });

  await t.test('3. Adaptive DPR scaling is active for low-core / mobile GPUs', () => {
    const bgCanvasCode = readFileSync('src/components/canvas/BackgroundCanvas.tsx', 'utf8');
    assert.match(bgCanvasCode, /navigator\.hardwareConcurrency/);
  });

  await t.test('4. Zero heavy 3D mesh assets in public folder (strict < 2MB limit)', () => {
    if (existsSync('public')) {
      const files = readdirSync('public');
      for (const file of files) {
        const stats = statSync(`public/${file}`);
        if (file.endsWith('.gltf') || file.endsWith('.glb') || file.endsWith('.obj')) {
          assert.ok(
            stats.size < 2 * 1024 * 1024,
            `Asset ${file} must be under 2MB performance budget`
          );
        }
      }
    }
  });
});
