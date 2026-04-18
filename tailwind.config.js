/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Zodiak"', '"Tiempos Headline"', 'Georgia', 'serif'],
        sans: ['"Switzer"', '"Söhne"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink:  { 950:'#04080a', 900:'#070d10', 850:'#0a1318', 800:'#0d191f' },
        moss: {
          50:'#ecfdf5', 100:'#d1fae5', 200:'#a7f3d0', 300:'#6ee7b7',
          400:'#34d399', 500:'#10b981', 600:'#059669', 700:'#047857',
          800:'#065f46', 900:'#064e3b',
        },
      },
      keyframes: {
        rise: {
          'from': { opacity: '0', transform: 'translateY(16px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          'from': { transform: 'translate3d(0,0,0)' },
          'to':   { transform: 'translate3d(-50%,0,0)' },
        },
        blink: {
          '0%,50%': { opacity: '1' },
          '51%,100%': { opacity: '0' },
        },
      },
      animation: {
        rise: 'rise .8s cubic-bezier(0.22,1,0.36,1) both',
        marquee: 'marquee 70s linear infinite',
        blink: 'blink 900ms steps(1) infinite',
      },
    },
  },
  plugins: [],
};
