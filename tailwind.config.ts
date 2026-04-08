import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effcf5',
          100: '#d8f8e6',
          200: '#b2efcf',
          300: '#7cdeaf',
          400: '#43c98d',
          500: '#1fca6d',
          600: '#10a37f',
          700: '#0f8367',
          800: '#116654',
          900: '#114f42'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(16, 64, 51, 0.08)',
        card: '0 12px 32px rgba(16, 64, 51, 0.08)'
      }
    },
  },
  plugins: [],
};

export default config;
