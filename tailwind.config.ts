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
        primary: {
          50: '#f0faf4',
          100: '#daf2e3',
          200: '#b8e5ca',
          300: '#88d2a8',
          400: '#52b880',
          500: '#2e9961',
          600: '#1a804e',
          700: '#006e46',
          800: '#005737',
          900: '#00402a',
        },
        accent: {
          300: '#c8d83a',
          400: '#bdd01e',
          500: '#aec80c',
          600: '#96ad0a',
          700: '#7d9008',
        },
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'Montserrat', 'Arial', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flash-bg': {
          '0%': { backgroundColor: 'rgba(174,200,12,0.3)' },
          '100%': { backgroundColor: 'transparent' },
        },
        ticker: {
          '0%': { transform: 'translateX(100vw)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-down': 'slide-down 0.4s ease-out',
        'flash-bg': 'flash-bg 2s ease-out',
        ticker: 'ticker 20s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
