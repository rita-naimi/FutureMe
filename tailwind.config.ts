import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050B18',
          900: '#0A1628',
          800: '#0F2040',
          700: '#1A3055'
        },
        twin: {
          DEFAULT: '#00C9A7',
          dark: '#00A389',
          light: '#7FFBE0'
        },
        risk: {
          low: '#22C55E',
          medium: '#F59E0B',
          high: '#EF4444'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 60px rgba(0, 201, 167, 0.18)'
      }
    }
  },
  plugins: []
};

export default config;
