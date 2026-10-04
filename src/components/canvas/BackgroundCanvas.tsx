'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const CanvasLayer = dynamic(
  () => import('./SceneContainer').then((mod) => mod.SceneContainer),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 -z-10 bg-warm-bg" />,
  }
);

export function BackgroundCanvas() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [adaptiveDpr, setAdaptiveDpr] = useState<[number, number]>([1, 1.5]);

  useEffect(() => {
    setMounted(true);

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
    return <div className="fixed inset-0 -z-10 bg-warm-bg" />;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none bg-warm-bg"
    >
      <Suspense fallback={<div className="fixed inset-0 -z-10 bg-warm-bg" />}>
        {isTabVisible && (
          <CanvasLayer reducedMotion={reducedMotion} dpr={adaptiveDpr} />
        )}
      </Suspense>
    </div>
  );
}
