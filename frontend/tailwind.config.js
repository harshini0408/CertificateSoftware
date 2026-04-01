/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#e8edf3',
          100: '#c5d1e0',
          200: '#9fb3cb',
          300: '#7895b5',
          400: '#587ea5',
          500: '#3a6896',
          600: '#2e5a88',
          700: '#234b76',
          800: '#1a3c62',
          900: '#1E3A5F',   // primary
          DEFAULT: '#1E3A5F',
        },
        gold: {
          50:  '#fdf8ec',
          100: '#f9edcc',
          200: '#f3d899',
          300: '#e9be5e',
          400: '#C9A84C',   // accent
          500: '#b8932f',
          600: '#9d7b22',
          700: '#7f621b',
          800: '#654e18',
          900: '#533f15',
          DEFAULT: '#C9A84C',
        },
        background: '#F8F9FA',
        foreground: '#1A1A2E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(30, 58, 95, 0.08)',
        modal: '0 8px 32px rgba(30, 58, 95, 0.16)',
      },
      screens: {
        xs: '375px',
      },
    },
  },
  plugins: [],
}
