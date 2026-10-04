'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import type * as THREE from 'three';

interface HeroSceneProps {
  reducedMotion?: boolean;
}

export function HeroScene({ reducedMotion = false }: HeroSceneProps) {
  const invoiceGroupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (reducedMotion) return;

    const time = state.clock.elapsedTime;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = time * 0.15;
      ring1Ref.current.rotation.y = time * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = -time * 0.12;
      ring2Ref.current.rotation.z = time * 0.08;
    }
    if (sphereRef.current) {
      sphereRef.current.position.y = -1.2 + Math.sin(time * 0.5) * 0.15;
    }
  });

  return (
    <group position={[1.2, 0, 0]}>
      {/* Primary Stacked Invoice Paper Forms (Pearl & Cream) */}
      <Float
        speed={reducedMotion ? 0 : 1.5}
        rotationIntensity={reducedMotion ? 0 : 0.4}
        floatIntensity={reducedMotion ? 0 : 0.6}
      >
        <group ref={invoiceGroupRef} rotation={[-0.15, 0.35, 0.05]}>
          {/* Base Sheet 1 */}
          <mesh position={[0, -0.1, -0.15]} rotation={[0, 0, -0.05]}>
            <boxGeometry args={[3.2, 4.4, 0.03]} />
            <meshStandardMaterial
              color="#EFEBE3" // Pearl white
              roughness={0.45}
              metalness={0.05}
            />
          </mesh>

          {/* Middle Sheet 2 */}
          <mesh position={[0.1, 0, -0.07]} rotation={[0, 0, 0.03]}>
            <boxGeometry args={[3.2, 4.4, 0.03]} />
            <meshStandardMaterial
              color="#F3EBD8" // Cream
              roughness={0.5}
              metalness={0.05}
            />
          </mesh>

          {/* Top Sheet 3 with Antique Gold Header Accent Bar */}
          <mesh position={[0.2, 0.1, 0]}>
            <boxGeometry args={[3.2, 4.4, 0.03]} />
            <meshStandardMaterial
              color="#F7F4EE" // Off-white
              roughness={0.4}
              metalness={0.08}
            />
          </mesh>
          <mesh position={[0.2, 2.05, 0.025]}>
            <boxGeometry args={[2.8, 0.12, 0.01]} />
            <meshStandardMaterial
              color="#B08D57" // Antique gold trim
              roughness={0.2}
              metalness={0.7}
            />
          </mesh>
        </group>
      </Float>

      {/* Outer Floating Geometric Rings in Antique Gold */}
      <Float
        speed={reducedMotion ? 0 : 1.2}
        rotationIntensity={reducedMotion ? 0 : 0.3}
        floatIntensity={reducedMotion ? 0 : 0.5}
      >
        <mesh ref={ring1Ref} position={[2.2, 1.5, -1.2]}>
          <torusGeometry args={[1.5, 0.05, 16, 64]} />
          <meshStandardMaterial
            color="#B08D57" // Antique gold
            roughness={0.25}
            metalness={0.65}
          />
        </mesh>
      </Float>

      <Float
        speed={reducedMotion ? 0 : 0.9}
        rotationIntensity={reducedMotion ? 0 : 0.2}
        floatIntensity={reducedMotion ? 0 : 0.4}
      >
        <mesh ref={ring2Ref} position={[-2.5, 0.8, -1.8]}>
          <torusGeometry args={[1.1, 0.04, 16, 48]} />
          <meshStandardMaterial
            color="#D9D0BF" // Warm sand
            roughness={0.3}
            metalness={0.4}
          />
        </mesh>
      </Float>

      {/* Floating Pearl & Cream Soft Spheres */}
      <Float
        speed={reducedMotion ? 0 : 1.8}
        rotationIntensity={reducedMotion ? 0 : 0.5}
        floatIntensity={reducedMotion ? 0 : 0.7}
      >
        <mesh ref={sphereRef} position={[-2.2, -1.2, -0.6]}>
          <sphereGeometry args={[0.75, 32, 32]} />
          <meshStandardMaterial
            color="#F3EBD8" // Cream
            roughness={0.3}
            metalness={0.15}
          />
        </mesh>
      </Float>

      <mesh position={[2.8, -1.8, -2]}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial
          color="#EFEBE3" // Pearl white
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
