'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

interface HeroSceneProps {
  reducedMotion?: boolean;
}

export function HeroScene({ reducedMotion = false }: HeroSceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.05;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {/* 3D Stacked Invoice Paper Planes in Pearl & Cream */}
      <mesh position={[0, 0, 0]} rotation={[-0.2, 0.4, 0]}>
        <boxGeometry args={[3, 4, 0.04]} />
        <meshStandardMaterial
          color="#EFEBE3"
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Floating Accent Ring in Antique Gold */}
      <mesh position={[1.8, 1.2, -1]} rotation={[0.6, 0.2, 0]}>
        <torusGeometry args={[1.2, 0.06, 16, 64]} />
        <meshStandardMaterial
          color="#B08D57"
          roughness={0.25}
          metalness={0.6}
        />
      </mesh>

      {/* Floating Pearl Sphere */}
      <mesh position={[-2.2, -1.2, -0.5]}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial
          color="#F3EBD8"
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>
    </group>
  );
}
