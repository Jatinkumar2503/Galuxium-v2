import React from 'react';

/**
 * Non-WebGL Static Fallback (Instruction 4.10)
 * Renders an archival warm visual motif if WebGL is unsupported, disabled, or fails.
 */
export function StaticCanvasFallback() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden select-none bg-warm-bg flex items-center justify-end pr-12 lg:pr-28 opacity-85"
    >
      <div className="relative w-80 h-96">
        {/* Layer 1: Base Sheet in Pearl */}
        <div className="absolute inset-0 rounded-2xl bg-warm-surface border border-warm-sand shadow-lg transform -rotate-6 translate-x-4 translate-y-6" />

        {/* Layer 2: Middle Sheet in Cream */}
        <div className="absolute inset-0 rounded-2xl bg-warm-cream border border-warm-sand shadow-xl transform rotate-3 -translate-x-2 translate-y-2" />

        {/* Layer 3: Top Sheet in Off-White with Antique Gold Header */}
        <div className="absolute inset-0 rounded-2xl bg-[#F7F4EE] border border-warm-sand shadow-2xl p-6 flex flex-col justify-between">
          <div className="w-full h-3 rounded-full bg-warm-accent" />
          <div className="space-y-2">
            <div className="w-3/4 h-2 rounded bg-warm-sand" />
            <div className="w-1/2 h-2 rounded bg-warm-sand" />
          </div>
          <div className="flex justify-between items-center pt-8 border-t border-warm-sand">
            <div className="w-16 h-2 rounded bg-warm-sand" />
            <div className="w-12 h-2 rounded bg-warm-bronze" />
          </div>
        </div>

        {/* Floating Ring in Antique Gold */}
        <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full border-4 border-warm-accent/70 pointer-events-none transform rotate-45" />

        {/* Floating Sphere */}
        <div className="absolute -bottom-8 -left-8 w-20 h-20 rounded-full bg-gradient-to-tr from-warm-cream to-warm-surface border border-warm-sand shadow-md" />
      </div>
    </div>
  );
}
