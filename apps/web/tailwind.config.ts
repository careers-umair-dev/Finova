import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        g: { DEFAULT: '#07865b', dark: '#066f4b', soft: '#e3f4eb' },
        mint: '#8fc2aa', canvas: '#f6f6f5', page: '#e6e7ec', ink: '#171717', mu: '#6b6b6b', line: '#eeeeec',
      },
      fontFamily: { sans: ['Outfit', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'pop-in': { from: { opacity: '0', transform: 'translate(-50%, -48%) scale(.97)' }, to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' } },
        'pop-out': { from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' }, to: { opacity: '0', transform: 'translate(-50%, -48%) scale(.97)' } },
        'drop-in': { from: { opacity: '0', transform: 'translateY(-4px) scale(.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'sheet-out': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in .15s ease-out', 'fade-out': 'fade-out .12s ease-in',
        'pop-in': 'pop-in .2s cubic-bezier(.16,1,.3,1)', 'pop-out': 'pop-out .12s ease-in',
        'drop-in': 'drop-in .15s ease-out', 'sheet-in': 'sheet-in .25s cubic-bezier(.16,1,.3,1)', 'sheet-out': 'sheet-out .18s ease-in',
      },
      boxShadow: { card: '0 2px 14px rgba(20,30,25,.05)', lift: '0 8px 28px rgba(20,30,25,.08)' },
    },
  },
  plugins: [],
} satisfies Config;
