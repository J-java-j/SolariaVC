/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"General Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', '"Times New Roman"', 'Times', 'serif'],
        display: ['"Source Serif 4"', 'Georgia', '"Times New Roman"', 'Times', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      fontSize: {
        'display-xl': ['clamp(3.5rem, 8.5vw, 7.25rem)', { lineHeight: '0.96', letterSpacing: '-0.042em' }],
        'display-md': ['clamp(2.375rem, 5vw, 4rem)', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        'body-lg': ['1.3125rem', { lineHeight: '1.65' }],
        body: ['1.125rem', { lineHeight: '1.62' }],
        caption: ['1rem', { lineHeight: '1.45', letterSpacing: '0.02em' }],
      },
      colors: {
        accent: {
          DEFAULT: '#49796B',
          soft: '#6a9489',
          deep: '#49796B',
        },
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      boxShadow: {
        surface: '0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.24)',
        'surface-md': '0 1px 0 rgba(255,255,255,0.06) inset, 0 12px 40px rgba(0,0,0,0.45)',
        'surface-lg': '0 1px 0 rgba(255,255,255,0.08) inset, 0 24px 64px rgba(0,0,0,0.55)',
      },
    },
  },
  plugins: [],
};
