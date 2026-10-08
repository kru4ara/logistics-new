'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function SearchInput({
  initialQ,
  year,
  month,
  status,
}: {
  initialQ: string;
  year: number;
  month: number | null;
  status: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Синхронизация с внешним значением (переход по ссылке / back / прямое открытие)
  useEffect(() => {
    setValue(initialQ);
  }, [initialQ]);

  // Debounce: 400мс после последнего нажатия
  useEffect(() => {
    // Не триггерим, если значение не изменилось (защита от первой отрисовки и от sync)
    if (value === initialQ) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (year) params.set('year', String(year));
      if (month) params.set('month', String(month));
      if (status) params.set('status', status);
      const trimmed = value.trim();
      if (trimmed) params.set('q', trimmed);

      const url = params.toString() ? `/trips?${params.toString()}` : '/trips';

      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, initialQ, year, month, status, router]);

  function handleClear() {
    setValue('');
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        🔍
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Поиск: номер заявки, маршрут, клиент, отправитель…"
        className="w-full rounded-xl border border-slate-300 pl-10 pr-12 py-2.5 text-base text-slate-900
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {isPending && (
          <span
            className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"
            aria-label="Идёт поиск"
          />
        )}
        {!isPending && value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1 transition-colors"
            aria-label="Очистить"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
