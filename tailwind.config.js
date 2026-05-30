/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#000000',
          800: '#0a0a0a',
          700: '#171717',
          950: '#000000',
        },
        accent: {
          DEFAULT: '#22c55e',
          glow: 'rgba(34, 197, 94, 0.3)',
        },
        orange: {
          DEFAULT: '#F97316',
          glow: 'rgba(249, 115, 22, 0.3)',
        }
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
}
