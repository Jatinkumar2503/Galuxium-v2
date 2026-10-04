import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-warm-charcoal uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={twMerge(
            clsx(
              'w-full px-3.5 py-2.5 rounded-xl border bg-warm-cream text-warm-charcoal text-sm placeholder:text-warm-taupe/60 transition-all',
              'focus:outline-none focus:ring-2 focus:ring-warm-accent focus:border-warm-accent',
              error ? 'border-warm-terracotta' : 'border-warm-sand',
              className
            )
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-warm-terracotta">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-warm-taupe">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
