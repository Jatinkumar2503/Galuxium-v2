'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { StaticCanvasFallback } from './StaticCanvasFallback';

const CanvasLayer = dynamic(
  () => import('./SceneContainer').then((mod) => mod.SceneContainer),
  {
    ssr: false,
    loading: () => <StaticCanvasFallback />,
  }
);

function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export function BackgroundCanvas() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [adaptiveDpr, setAdaptiveDpr] = useState<[number, number]>([1, 1.5]);

  useEffect(() => {
    setMounted(true);

    // 0. Verify WebGL support
    setHasWebGL(isWebGLAvailable());

    // 1. Check reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const motionHandler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', motionHandler);

    // 2. Pause when tab is hidden (performance budget)
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Adaptive GPU scaling: lower DPR on devices with <= 4 cores
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      setAdaptiveDpr([0.85, 1.0]);
    }

    return () => {
      mediaQuery.removeEventListener('change', motionHandler);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (!mounted) {
    return <StaticCanvasFallback />;
  }

  // Non-WebGL graceful fallback
  if (!hasWebGL) {
    return <StaticCanvasFallback />;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none bg-warm-bg"
    >
      <Suspense fallback={<StaticCanvasFallback />}>
        {isTabVisible && (
          <CanvasLayer reducedMotion={reducedMotion} dpr={adaptiveDpr} />
        )}
      </Suspense>
    </div>
  );
}
