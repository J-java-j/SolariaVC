/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Zodiak"', 'Georgia', 'serif'],
        sans: ['"Cabinet Grotesk"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        moss: {
          400: '#34d399',
          300: '#6ee7b7',
        },
      },
      keyframes: {
        rise: {
          'from': { opacity: '0', transform: 'translateY(14px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          'from': { transform: 'translate3d(0,0,0)' },
          'to':   { transform: 'translate3d(-50%,0,0)' },
        },
        chUp: {
          'from': { opacity: '0', transform: 'translateY(0.4em)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        scribbleDraw: {
          'from': { strokeDashoffset: '2000' },
          'to':   { strokeDashoffset: '0' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%':     { opacity: '0.45', transform: 'scale(0.85)' },
        },
        breath: {
          '0%,100%': { transform: 'scale(1)', opacity: '0.55' },
          '50%':     { transform: 'scale(1.08)', opacity: '0.75' },
        },
      },
      animation: {
        rise: 'rise 1s cubic-bezier(0.22,1,0.36,1) both',
        marquee: 'marquee 48s linear infinite',
        breath: 'breath 9s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
