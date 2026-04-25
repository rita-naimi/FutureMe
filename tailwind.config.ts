import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#060B18',
          900: '#0C1628',
          800: '#0F2040',
          700: '#1A3055'
        },
        twin: {
          DEFAULT: '#00C9A7',
          dark: '#00A389',
          deeper: '#008F78',
          light: '#7FFBE0'
        },
        ivory: {
          DEFAULT: '#FAF7F2',
          dark: '#F0EBE3'
        },
        risk: {
          low: '#22C55E',
          medium: '#F59E0B',
          high: '#EF4444'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Cal Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        glow: '0 0 60px rgba(0, 201, 167, 0.18)'
      }
    }
  },
  plugins: []
};

export default config;
