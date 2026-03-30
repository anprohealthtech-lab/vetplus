/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Vetplus Diagnostics Brand Colors (from logo)
        brand: {
          50:  '#e8f6f9',
          100: '#c5e9f1',
          200: '#9dd8e7',
          300: '#6dc5da',
          400: '#48b5cf',
          500: '#2A8FA3', // Primary teal (logo body)
          600: '#237d8f',
          700: '#1c6a79',
          800: '#155763',
          900: '#0d3c45',
        },
        navy: {
          50:  '#e8edf3',
          100: '#c5d0de',
          200: '#9eb0c7',
          300: '#748faf',
          400: '#547099',
          500: '#2f5382',
          600: '#254573',
          700: '#1a3a5c', // Primary navy (logo DNA/dark)
          800: '#102843',
          900: '#07162b',
        },
      },
      spacing: {
        'safe-top': 'var(--safe-area-inset-top)',
        'safe-bottom': 'var(--safe-area-inset-bottom)',
        'safe-left': 'var(--safe-area-inset-left)',
        'safe-right': 'var(--safe-area-inset-right)',
        'mobile-edge': 'var(--mobile-edge-margin)',
        'mobile-content': 'var(--mobile-content-padding)',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1a3a5c 0%, #2A8FA3 100%)',
        'brand-gradient-reverse': 'linear-gradient(135deg, #2A8FA3 0%, #1a3a5c 100%)',
      },
    },
  },
  plugins: [],
};
