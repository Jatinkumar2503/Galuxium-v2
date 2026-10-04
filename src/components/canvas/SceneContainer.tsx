'use client';

import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { HeroScene } from './HeroScene';

interface SceneContainerProps {
  reducedMotion?: boolean;
}

export function SceneContainer({ reducedMotion = false }: SceneContainerProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      className="w-full h-full"
    >
      {/* Strictly Warm Lighting: Off-white ambient, cream key, and antique gold rim light */}
      <ambientLight color="#F7F4EE" intensity={0.8} />
      <directionalLight position={[5, 8, 5]} color="#F3EBD8" intensity={1.2} />
      <pointLight position={[-6, -4, -2]} color="#B08D57" intensity={0.6} />

      <HeroScene reducedMotion={reducedMotion} />
    </Canvas>
  );
}
