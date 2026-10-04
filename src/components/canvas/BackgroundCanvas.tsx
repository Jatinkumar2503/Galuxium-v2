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

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
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
        <CanvasLayer reducedMotion={reducedMotion} />
      </Suspense>
    </div>
  );
}
