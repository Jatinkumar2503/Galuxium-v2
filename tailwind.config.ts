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
          accent: '#B08D57', // Antique gold
          amber: '#C98A2B', // Warning / needs review
          terracotta: '#B5523B', // Error / rejected
          bronze: '#8A6A3B', // Success / matched
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
