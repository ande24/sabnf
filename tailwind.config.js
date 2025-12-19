/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    './components/**/*.{js,ts,tsx}'
  ],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    screens: {
      '3xs': '400px',
      '2xs': '480px',
      xs: '560px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      gridTemplateColumns: {
        3: 'repeat(3, minmax(0, 1fr))',
      }
    },
  },
  plugins: [],
};
