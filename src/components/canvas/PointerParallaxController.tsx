'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PointerParallaxControllerProps {
  reducedMotion?: boolean;
}

export function PointerParallaxController({ reducedMotion = false }: PointerParallaxControllerProps) {
  const pointerNorm = useRef({ x: 0, y: 0 });
  const currentTilt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Desktop pointer tracking (normalized -1 to +1)
    const handlePointerMove = (e: PointerEvent) => {
      pointerNorm.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerNorm.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    // Mobile touch drag tracking
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        pointerNorm.current.x = (touch.clientX / window.innerWidth) * 2 - 1;
        pointerNorm.current.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      }
    };

    // Mobile device tilt sensor tracking (gyroscope fallback)
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // Clamp gamma between -45 and +45 deg
        pointerNorm.current.x = Math.max(-1, Math.min(1, e.gamma / 45));
        pointerNorm.current.y = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  useFrame((state, delta) => {
    if (reducedMotion) return;

    // Target tilt angles (smooth damping)
    const targetX = pointerNorm.current.y * 0.25; // Pitch
    const targetY = pointerNorm.current.x * 0.35; // Yaw

    currentTilt.current.x = THREE.MathUtils.lerp(currentTilt.current.x, targetX, delta * 3);
    currentTilt.current.y = THREE.MathUtils.lerp(currentTilt.current.y, targetY, delta * 3);

    // Apply parallax tilt to active scene camera offset
    state.camera.rotation.x = currentTilt.current.x;
    state.camera.rotation.y = currentTilt.current.y;
  });

  return null;
}
