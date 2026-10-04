'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

interface HeroSceneProps {
  reducedMotion?: boolean;
}

export function HeroScene({ reducedMotion = false }: HeroSceneProps) {
  const masterGroupRef = useRef<THREE.Group>(null);
  const sheet1Ref = useRef<THREE.Mesh>(null);
  const sheet2Ref = useRef<THREE.Mesh>(null);
  const sheet3Ref = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const sphere1Ref = useRef<THREE.Mesh>(null);
  const sphere2Ref = useRef<THREE.Mesh>(null);

  // Independent harmonic oscillation frequencies (ambient idle motion never stops)
  useFrame((state, delta) => {
    if (reducedMotion) return;

    const t = state.clock.elapsedTime;

    // Master group gentle breathing drift
    if (masterGroupRef.current) {
      masterGroupRef.current.position.y = Math.sin(t * 0.4) * 0.12;
      masterGroupRef.current.position.x = 1.0 + Math.cos(t * 0.3) * 0.08;
    }

    // Sheet 1: Slow subtle lag oscillation
    if (sheet1Ref.current) {
      sheet1Ref.current.position.y = -0.1 + Math.sin(t * 0.6 + 0.2) * 0.05;
      sheet1Ref.current.rotation.z = -0.05 + Math.cos(t * 0.4) * 0.02;
    }

    // Sheet 2: Middle sheet intermediate phase
    if (sheet2Ref.current) {
      sheet2Ref.current.position.y = Math.sin(t * 0.7 + 0.8) * 0.06;
      sheet2Ref.current.rotation.z = 0.03 + Math.sin(t * 0.5) * 0.025;
    }

    // Sheet 3: Top sheet with antique gold bar
    if (sheet3Ref.current) {
      sheet3Ref.current.position.y = 0.1 + Math.sin(t * 0.8 + 1.6) * 0.07;
      sheet3Ref.current.rotation.x = -0.15 + Math.sin(t * 0.45) * 0.03;
    }

    // Ring 1: Continuous multi-axis rotation
    if (ring1Ref.current) {
      ring1Ref.current.rotation.x += delta * 0.2;
      ring1Ref.current.rotation.y += delta * 0.28;
      ring1Ref.current.position.y = 1.5 + Math.sin(t * 0.55) * 0.18;
    }

    // Ring 2: Counter-axis continuous rotation
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y -= delta * 0.16;
      ring2Ref.current.rotation.z += delta * 0.12;
      ring2Ref.current.position.x = -2.5 + Math.cos(t * 0.45) * 0.15;
    }

    // Spheres: Floating orbital buoyancy
    if (sphere1Ref.current) {
      sphere1Ref.current.position.y = -1.2 + Math.sin(t * 0.65) * 0.22;
      sphere1Ref.current.position.x = -2.2 + Math.cos(t * 0.5) * 0.15;
    }
    if (sphere2Ref.current) {
      sphere2Ref.current.position.y = -1.8 + Math.cos(t * 0.7) * 0.16;
      sphere2Ref.current.position.z = -2.0 + Math.sin(t * 0.4) * 0.2;
    }
  });

  return (
    <group ref={masterGroupRef} position={[1.0, 0, 0]}>
      {/* Stacked Invoice Paper Sheets */}
      <group rotation={[-0.15, 0.35, 0.05]}>
        {/* Sheet 1 (Base Pearl) */}
        <mesh ref={sheet1Ref} position={[0, -0.1, -0.15]} rotation={[0, 0, -0.05]}>
          <boxGeometry args={[3.2, 4.4, 0.03]} />
          <meshStandardMaterial color="#EFEBE3" roughness={0.45} metalness={0.05} />
        </mesh>

        {/* Sheet 2 (Middle Cream) */}
        <mesh ref={sheet2Ref} position={[0.1, 0, -0.07]} rotation={[0, 0, 0.03]}>
          <boxGeometry args={[3.2, 4.4, 0.03]} />
          <meshStandardMaterial color="#F3EBD8" roughness={0.5} metalness={0.05} />
        </mesh>

        {/* Sheet 3 (Top Off-White with Antique Gold Header Bar) */}
        <group ref={sheet3Ref} position={[0.2, 0.1, 0]}>
          <mesh>
            <boxGeometry args={[3.2, 4.4, 0.03]} />
            <meshStandardMaterial color="#F7F4EE" roughness={0.4} metalness={0.08} />
          </mesh>
          <mesh position={[0, 1.95, 0.025]}>
            <boxGeometry args={[2.8, 0.14, 0.01]} />
            <meshStandardMaterial color="#B08D57" roughness={0.2} metalness={0.7} />
          </mesh>
        </group>
      </group>

      {/* Floating Geometric Rings */}
      <mesh ref={ring1Ref} position={[2.2, 1.5, -1.2]}>
        <torusGeometry args={[1.5, 0.05, 16, 64]} />
        <meshStandardMaterial color="#B08D57" roughness={0.25} metalness={0.65} />
      </mesh>

      <mesh ref={ring2Ref} position={[-2.5, 0.8, -1.8]}>
        <torusGeometry args={[1.1, 0.04, 16, 48]} />
        <meshStandardMaterial color="#D9D0BF" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Floating Spheres */}
      <mesh ref={sphere1Ref} position={[-2.2, -1.2, -0.6]}>
        <sphereGeometry args={[0.75, 32, 32]} />
        <meshStandardMaterial color="#F3EBD8" roughness={0.3} metalness={0.15} />
      </mesh>

      <mesh ref={sphere2Ref} position={[2.8, -1.8, -2]}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial color="#EFEBE3" roughness={0.35} metalness={0.1} />
      </mesh>
    </group>
  );
}
