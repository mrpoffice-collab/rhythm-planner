/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Domain colors - warm minimalist palette
        work: '#3A5BA0',
        chore: '#8FAE8F',
        errand: '#D6A656',
        personal: '#D58B7C',
        creative: '#A88FB0',
        neutral: '#C5C6CA',

        // Base colors
        background: '#F9FAFB',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        DEFAULT: '0 1px 3px rgba(0,0,0,0.1)',
        md: '0 4px 6px rgba(0,0,0,0.1)',
        lg: '0 10px 15px rgba(0,0,0,0.1)',
      },
      spacing: {
        'internal': '1.25rem',
      },
    },
  },
  plugins: [],
}
