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
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

test('Color Palette Linter: Strict Prohibition of Blue and Green (4.1)', async (t) => {
  const allSourceFiles = getFilesRecursively('src');

  // Forbidden Tailwind color class patterns
  const FORBIDDEN_CLASS_PATTERNS = [
    /\b(text|bg|border|ring|stroke|fill)-(blue|green|emerald|teal|cyan|indigo|sky)-\d+\b/i,
    /\b(focus:ring|focus:border)-(blue|green|emerald|teal|cyan|indigo|sky)-\d+\b/i,
    /#00[0-9a-f]{4}/i, // Raw green/cyan hexes
    /#0000ff/i,        // Pure blue
    /#10b981/i,        // Tailwind emerald-500
    /#22c55e/i,        // Tailwind green-500
    /#3b82f6/i,        // Tailwind blue-500
    /#0ea5e9/i,        // Tailwind sky-500
  ];

  await t.test('No source file in src/ contains forbidden blue or green classes or hex codes', () => {
    const violations = [];

    for (const file of allSourceFiles) {
      const content = readFileSync(file, 'utf8');

      for (const pattern of FORBIDDEN_CLASS_PATTERNS) {
        const match = content.match(pattern);
        if (match) {
          violations.push({
            file,
            violation: match[0],
            line: content.substring(0, match.index).split('\n').length,
          });
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Design system violation: Blue or green hues detected:\n${JSON.stringify(violations, null, 2)}`
    );
  });

  await t.test('All defined design tokens map to authorized warm neutral palette', () => {
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    assert.match(tokens, /--color-warm-bg:\s*#F7F4EE/i);
    assert.match(tokens, /--color-warm-surface:\s*#EFEBE3/i);
    assert.match(tokens, /--color-warm-cream:\s*#F3EBD8/i);
    assert.match(tokens, /--color-warm-sand:\s*#D9D0BF/i);
    assert.match(tokens, /--color-warm-charcoal:\s*#2B2824/i);
    assert.match(tokens, /--color-warm-taupe:\s*#6E665A/i);
    assert.match(tokens, /--color-warm-accent:\s*#B08D57/i);
    assert.match(tokens, /--color-warm-amber:\s*#C98A2B/i);
    assert.match(tokens, /--color-warm-terracotta:\s*#B5523B/i);
    assert.match(tokens, /--color-warm-bronze:\s*#8A6A3B/i);
  });
});
