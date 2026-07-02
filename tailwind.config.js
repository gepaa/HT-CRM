/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          850: '#172033',
          900: '#0f172a',
          950: '#020617',
        },
        hot: { DEFAULT: '#ef4444', light: '#fecaca', dark: '#991b1b' },
        warm: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#92400e' },
        cold: { DEFAULT: '#3b82f6', light: '#dbeafe', dark: '#1e40af' },
        qualified: { DEFAULT: '#a855f7', light: '#e9d5ff', dark: '#581c87' },
        bad_fit: { DEFAULT: '#64748b', light: '#f1f5f9', dark: '#334155' },
        success: { DEFAULT: '#10b981', light: '#d1fae5', dark: '#065f46' },
        danger: { DEFAULT: '#ef4444', light: '#fee2e2', dark: '#991b1b' },
        warning: { DEFAULT: '#f59e0b', light: '#fef3c7', dark: '#92400e' },
        info: { DEFAULT: '#38bdf8', light: '#e0f2fe', dark: '#0369a1' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
