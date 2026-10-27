/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors — change here once, updates everywhere
        brand: {
          orange:      '#F97316', // primary CTA, buttons, accents
          'orange-dark': '#EA6C0A', // hover state for orange
          navy:        '#0F172A', // headings, dark backgrounds
          'navy-light': '#1E293B', // cards on dark backgrounds
          cream:       '#FFF7ED', // light orange tint backgrounds
        },
      },
      fontFamily: {
        // Set after we add Google Fonts to layout.js
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
        // sans    — body text, labels, inputs
        // display — headings, hero text
      },
      animation: {
        'fade-up':   'fadeUp 0.5s ease-out forwards',
        'fade-in':   'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;