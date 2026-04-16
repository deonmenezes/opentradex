/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // OpenTradex dark theme palette
        bg: '#0B0F14',
        surface: '#121821',
        'surface-2': '#1A2230',
        border: '#222C3B',
        text: '#E6EDF3',
        'text-dim': '#8B97A8',
        accent: '#3FB68B',
        'accent-dim': '#1F6E54',
        danger: '#E5484D',
        warning: '#F5A623',
        // Additional UI colors
        'card-hover': '#1E2736',
        'input-bg': '#0D1117',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
