@import "tailwindcss";

@theme {
  /* 1. Переносим цвета */
  --color-brand-50: #eef2ff;
  --color-brand-100: #e0e7ff;
  --color-brand-200: #c7d2fe;
  --color-brand-300: #a5b4fc;
  --color-brand-400: #818cf8;
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;
  --color-brand-700: #4338ca;
  --color-brand-800: #3730a3;
  --color-brand-900: #312e81;
  --color-brand-950: #1e1b4b;

  --color-accent-50: #faf5ff;
  --color-accent-100: #f3e8ff;
  --color-accent-200: #e9d5ff;
  --color-accent-300: #d8b4fe;
  --color-accent-400: #c084fc;
  --color-accent-500: #a855f7;
  --color-accent-600: #9333ea;
  --color-accent-700: #7e22ce;
  --color-accent-800: #6b21a8;
  --color-accent-900: #581c87;

  --color-ink-50: #f8fafc;
  --color-ink-100: #f1f5f9;
  --color-ink-200: #e2e8f0;
  --color-ink-300: #cbd5e1;
  --color-ink-400: #94a3b8;
  --color-ink-500: #64748b;
  --color-ink-600: #475569;
  --color-ink-700: #334155;
  --color-ink-800: #1e293b;
  --color-ink-900: #0f172a;
  --color-ink-950: #020617;

  /* 2. Переносим тени */
  --shadow-brand-sm: 0 1px 2px 0 rgba(79, 70, 229, 0.05);
  --shadow-brand: 0 4px 12px -2px rgba(79, 70, 229, 0.15);
  --shadow-brand-lg: 0 12px 24px -4px rgba(79, 70, 229, 0.20);
  --shadow-soft: 0 2px 8px -2px rgba(15, 23, 42, 0.06), 0 4px 16px -4px rgba(15, 23, 42, 0.04);
  --shadow-soft-lg: 0 8px 24px -6px rgba(15, 23, 42, 0.10), 0 16px 40px -8px rgba(15, 23, 42, 0.06);

  /* 3. Переносим скругления */
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
  --radius-3xl: 1.25rem;

  /* 4. Переносим анимации */
  --animate-fade-in: fade-in 200ms ease-out;
  --animate-slide-up: slide-up 250ms cubic-bezier(0.16, 1, 0.3, 1);
  --animate-slide-down: slide-down 200ms ease-out;
  --animate-scale-in: scale-in 150ms cubic-bezier(0.16, 1, 0.3, 1);
  --animate-shimmer: shimmer 2s linear infinite;

  @keyframes fade-in {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }
  @keyframes slide-up {
    0% { opacity: 0; transform: translateY(6px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-down {
    0% { opacity: 0; transform: translateY(-6px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes scale-in {
    0% { opacity: 0; transform: scale(0.96); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
}

/* ============================================================
   Базовые стили
   ============================================================ */

@layer base {
  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    scroll-behavior: smooth;
  }

  body {
    @apply bg-slate-50 text-slate-900;
  }

  .tabular-nums,
  table td,
  table th {
    font-variant-numeric: tabular-nums;
  }

  /* В Tailwind 4 theme() заменен на var() */
  :focus-visible {
    outline: 2px solid var(--color-brand-500);
    outline-offset: 2px;
    border-radius: 4px;
  }

  input:focus,
  textarea:focus,
  select:focus {
    outline: none;
  }
}

/* ============================================================
   Утилиты — переиспользуемые классы для типовых карточек/кнопок
   ============================================================ */

@layer components {
  .card {
    @apply bg-white rounded-2xl border border-slate-100 shadow-soft transition-shadow duration-200;
  }
  .card-hover {
    @apply hover:shadow-soft-lg hover:border-brand-200 md:hover:-translate-y-0.5 transition-all duration-200;
  }

  .btn {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold
           transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .btn-primary {
    @apply bg-brand-600 hover:bg-brand-700 text-white shadow-brand hover:shadow-brand-lg;
  }
  .btn-secondary {
    @apply bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300;
  }
  .btn-ghost {
    @apply text-slate-600 hover:bg-slate-100 hover:text-slate-900;
  }
  .btn-danger {
    @apply bg-red-50 text-red-600 border border-red-200 hover:bg-red-100;
  }

  .input {
    @apply w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900
           placeholder:text-slate-400
           focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
           transition-all duration-150;
  }

  .badge {
    @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border;
  }

  .skeleton {
    @apply bg-slate-200 rounded animate-pulse;
  }
}

/* ============================================================
   Скроллбар — тонкий и аккуратный
   ============================================================ */

@layer utilities {
  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: rgb(203 213 225);
    border-radius: 8px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: rgb(148 163 184);
  }
}
