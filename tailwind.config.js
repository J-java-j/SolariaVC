/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#070605',
          900: '#0d0b09',
          800: '#15120e',
          700: '#1f1a14',
        },
        sun: {
          50: '#fff8eb',
          100: '#ffeac4',
          200: '#ffd485',
          300: '#ffb947',
          400: '#ff9d1f',
          500: '#f57f0c',
          600: '#d96106',
          700: '#b34708',
          800: '#90380e',
          900: '#762f10',
        },
      },
      animation: {
        'pulse-slow': 'pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 60s linear infinite',
        'rise': 'rise 1s ease-out forwards',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
