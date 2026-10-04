import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: '#F7F4EE', // Off-white
          surface: '#EFEBE3', // Pearl white
          cream: '#F3EBD8', // Raised surface / cards
          sand: '#D9D0BF', // Border / dividers
          charcoal: '#2B2824', // Primary text
          taupe: '#6E665A', // Secondary text
          accent: '#B08D57', // Antique gold (decorative / large headings)
          amber: '#C98A2B', // Warning / needs review
          terracotta: '#B5523B', // Error / rejected
          bronze: '#8A6A3B', // Success / matched (WCAG AA text)
        },
      },
      fontFamily: {
        serif: [
          '"Newsreader"',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
        sans: [
          '"Plus Jakarta Sans"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '0.875rem', letterSpacing: '0.02em' }], // 11px
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],          // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem' }],                               // 14px
        base: ['1rem', { lineHeight: '1.5rem' }],                                  // 16px
        lg: ['1.125rem', { lineHeight: '1.625rem' }],                              // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],                                // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em' }],       // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '2.625rem', letterSpacing: '-0.025em' }], // 36px
        '5xl': ['3rem', { lineHeight: '3.25rem', letterSpacing: '-0.03em' }],      // 48px
        '6xl': ['3.75rem', { lineHeight: '4rem', letterSpacing: '-0.035em' }],     // 60px
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
    },
  },
  plugins: [],
};

export default config;
