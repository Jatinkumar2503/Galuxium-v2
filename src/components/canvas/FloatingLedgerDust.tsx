'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

interface FloatingLedgerDustProps {
  count?: number;
  reducedMotion?: boolean;
}

/**
 * Floating archival paper and gold particles drifting ambiently across the 3D scene.
 */
export function FloatingLedgerDust({ count = 35, reducedMotion = false }: FloatingLedgerDustProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sca = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1;
      sca[i] = Math.random() * 0.04 + 0.02;
    }

    return [pos, sca];
  }, [count]);

  useFrame((state, delta) => {
    if (reducedMotion || !pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += delta * 0.15; // Slow upward drift
      pos[i * 3] += Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.002;

      // Wrap around when rising past ceiling
      if (pos[i * 3 + 1] > 6) {
        pos[i * 3 + 1] = -6;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#B08D57" // Antique gold specks
        transparent
        opacity={0.45}
        sizeAttenuation
      />
    </points>
  );
}
