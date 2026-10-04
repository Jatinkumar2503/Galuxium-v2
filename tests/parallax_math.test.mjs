import test from 'node:test';
import assert from 'node:assert/strict';

function calculateParallaxTilt(pointerX, pointerY, delta, currentTilt) {
  const targetX = pointerY * 0.25;
  const targetY = pointerX * 0.35;

  const lerp = (start, end, alpha) => start + (end - start) * alpha;
  const damping = Math.min(delta * 3, 0.2);

  const nextX = lerp(currentTilt.x, targetX, damping);
  const nextY = lerp(currentTilt.y, targetY, damping);

  return { x: nextX, y: nextY };
}

test('Parallax Tilt Math & Damping Calculation Tests (4.7)', async (t) => {
  await t.test('1. Parallax clamps within maximum pitch and yaw thresholds', () => {
    // Extreme corner cursor position (1.0, 1.0)
    let tilt = { x: 0, y: 0 };
    for (let frame = 0; frame < 60; frame++) {
      tilt = calculateParallaxTilt(1.0, 1.0, 1 / 60, tilt);
    }

    assert.ok(tilt.x <= 0.25, 'Pitch tilt should not exceed 0.25 rad');
    assert.ok(tilt.y <= 0.35, 'Yaw tilt should not exceed 0.35 rad');
    assert.ok(tilt.x > 0.2, 'Pitch tilt should smoothly converge towards target');
  });

  await t.test('2. Parallax returns to neutral center when cursor centers (0, 0)', () => {
    let tilt = { x: 0.25, y: 0.35 };
    for (let frame = 0; frame < 120; frame++) {
      tilt = calculateParallaxTilt(0, 0, 1 / 60, tilt);
    }

    assert.ok(Math.abs(tilt.x) < 0.005, 'Pitch must decay to neutral center');
    assert.ok(Math.abs(tilt.y) < 0.005, 'Yaw must decay to neutral center');
  });
});
