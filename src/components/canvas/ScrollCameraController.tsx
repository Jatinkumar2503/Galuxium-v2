'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface ScrollCameraControllerProps {
  reducedMotion?: boolean;
}

export function ScrollCameraController({ reducedMotion = false }: ScrollCameraControllerProps) {
  const { camera } = useThree();
  const scrollProgress = useRef(0);
  const targetPos = useRef(new THREE.Vector3(0, 0, 7.5));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      scrollProgress.current = Math.min(Math.max(progress, 0), 1);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useFrame((_, delta) => {
    if (reducedMotion) return;

    const p = scrollProgress.current;

    // Camera Trajectory Waypoints across scroll progress (0.0 to 1.0)
    // Section 1: Hero (Overview)
    // Section 2: Middle (Close fly-through around invoice stack)
    // Section 3: Bottom (Elevated compliance overview)
    if (p < 0.5) {
      const sub = p / 0.5;
      targetPos.current.set(
        THREE.MathUtils.lerp(0, 1.4, sub),
        THREE.MathUtils.lerp(0, -0.6, sub),
        THREE.MathUtils.lerp(7.5, 4.8, sub)
      );
      targetLook.current.set(
        THREE.MathUtils.lerp(0, 0.8, sub),
        THREE.MathUtils.lerp(0, 0, sub),
        0
      );
    } else {
      const sub = (p - 0.5) / 0.5;
      targetPos.current.set(
        THREE.MathUtils.lerp(1.4, -1.2, sub),
        THREE.MathUtils.lerp(-0.6, 0.8, sub),
        THREE.MathUtils.lerp(4.8, 6.2, sub)
      );
      targetLook.current.set(
        THREE.MathUtils.lerp(0.8, 0, sub),
        0,
        0
      );
    }

    // Smooth damping
    const damping = Math.min(delta * 2.8, 0.1);
    camera.position.lerp(targetPos.current, damping);
    camera.lookAt(targetLook.current);
  });

  return null;
}
