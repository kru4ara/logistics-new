'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

type Match = {
  id: string;
  name: string;
  info: string | null;
  href: string;
};

export default function DuplicateChecker({
  type,
  inputName,
  taxIdInputName,
  label,
  placeholder,
  required,
}: {
  type: 'client' | 'contractor';
  inputName: string;
  /** Название другого input в той же форме — откуда брать tax_id для проверки */
  taxIdInputName?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState('');
  const [taxId, setTaxId] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Если есть поле tax_id — следим за его изменением
  useEffect(() => {
    if (!taxIdInputName) return;
    const el = document.querySelector<HTMLInputElement>(`input[name="${taxIdInputName}"]`);
    if (!el) return;
    const handler = () => {
      setTaxId(el.value);
    };
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [taxIdInputName]);

  // Debounce-проверка
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!value || value.trim().length < 2) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const params = new URLSearchParams({ type, q: value.trim() });
        if (taxId) params.set('taxId', taxId);

        const res = await fetch(`/api/check-duplicates?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setMatches(Array.isArray(data.matches) ? data.matches : []);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[DuplicateChecker] fetch error:', e);
        }
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, taxId, type]);

  // Сброс при вводе пустой строки — в onChange, а не в эффекте
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);
    if (!next || next.trim().length < 2) {
      setMatches([]);
      setLoading(false);
    }
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}
      <input
        type="text"
        name={inputName}
        required={required}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="input"
      />

      {matches.length > 0 && (
        <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
            Похожие уже есть — возможно, дубль:
          </div>
          <ul className="space-y-1">
            {matches.map((m) => (
              <li key={m.id}>
                <a
                  href={m.href}
                  className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-amber-100/60 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">
                      {m.name}
                    </div>
                    {m.info && (
                      <div className="text-xs text-slate-500 truncate">{m.info}</div>
                    )}
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform"
                    strokeWidth={2.2}
                  />
                </a>
              </li>
            ))}
          </ul>
          <div className="text-[10px] text-amber-700 pt-1">
            Кликните на существующего, чтобы открыть — или продолжайте создавать нового.
          </div>
        </div>
      )}
    </div>
  );
}
