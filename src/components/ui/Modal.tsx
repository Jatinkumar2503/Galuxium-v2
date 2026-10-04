'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, description, children }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Warm Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-warm-charcoal/40 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog Body */}
      <div className="relative w-full max-w-lg rounded-2xl border border-warm-sand bg-warm-surface p-6 shadow-xl space-y-4 z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-serif font-bold text-warm-charcoal">{title}</h3>
            {description && <p className="text-xs text-warm-taupe">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-warm-taupe hover:text-warm-charcoal hover:bg-warm-cream focus:outline-none focus:ring-2 focus:ring-warm-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}
