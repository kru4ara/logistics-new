/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Брендовая палитра — indigo/violet, заменит blue-600 везде
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Дополнительный акцент (для градиентов, hover-состояний)
        accent: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        // Тёмный для навбара/sidebar
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      boxShadow: {
        // Мягкие цветные тени
        'brand-sm': '0 1px 2px 0 rgba(79, 70, 229, 0.05)',
        'brand':    '0 4px 12px -2px rgba(79, 70, 229, 0.15)',
        'brand-lg': '0 12px 24px -4px rgba(79, 70, 229, 0.20)',
        'soft':     '0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 4px 16px -4px rgba(15, 23, 42, 0.04)',
        'soft-lg':  '0 8px 24px -6px rgba(15, 23, 42, 0.10), 0 16px 40px -8px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        'xl':  '0.75rem',   // 12px
        '2xl': '1rem',      // 16px — оставляем как было
        '3xl': '1.25rem',   // 20px
      },
      fontFamily: {
        // Для заголовков можно использовать позже
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%':   { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'fade-in':   'fade-in 200ms ease-out',
        'slide-up':  'slide-up 250ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 200ms ease-out',
        'scale-in':  'scale-in 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer':   'shimmer 2s linear infinite',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
