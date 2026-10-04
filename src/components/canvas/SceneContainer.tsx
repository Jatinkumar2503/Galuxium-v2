'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { HeroScene } from './HeroScene';
import { FloatingLedgerDust } from './FloatingLedgerDust';

interface SceneContainerProps {
  reducedMotion?: boolean;
}

export function SceneContainer({ reducedMotion = false }: SceneContainerProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.5], fov: 42 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      className="w-full h-full"
    >
      {/* Strictly Warm Lighting: Off-white ambient, cream key, and antique gold rim light */}
      <ambientLight color="#F7F4EE" intensity={0.75} />
      <directionalLight position={[6, 9, 5]} color="#F3EBD8" intensity={1.1} />
      <pointLight position={[-5, -3, 2]} color="#B08D57" intensity={0.5} distance={15} />

      {/* Floating 3D Hero Forms */}
      <HeroScene reducedMotion={reducedMotion} />

      {/* Ambient Archival Gold Particle Dust */}
      <FloatingLedgerDust count={30} reducedMotion={reducedMotion} />

      {/* Subtle Warm Charcoal Contact Shadows */}
      <ContactShadows
        position={[0, -2.8, 0]}
        opacity={0.3}
        scale={14}
        blur={2.4}
        far={5}
        color="#2B2824"
      />
    </Canvas>
  );
}
