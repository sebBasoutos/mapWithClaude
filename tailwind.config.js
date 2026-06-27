/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    fontFamily: {
      sans: ['Arial', 'Helvetica', 'sans-serif'],
    },
    extend: {
      colors: {
        brand: '#007dbb',
        'brand-dark': '#0067a0',
      },
    },
  },
  plugins: [],
};
