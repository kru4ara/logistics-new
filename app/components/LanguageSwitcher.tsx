'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { LOCALES, LOCALE_LABELS } from '../../lib/i18n/config';
import { setLocale } from '../locale-actions';
import { useT } from './I18nProvider';

/** Выбор языка интерфейса. tone — под светлый или тёмный фон. */
export default function LanguageSwitcher({
  tone = 'light',
  compact = false,
}: {
  tone?: 'light' | 'dark';
  compact?: boolean;
}) {
  const { t, locale } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const colors =
    tone === 'dark'
      ? 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';

  return (
    <label className={`inline-flex items-center gap-1.5 text-xs ${pending ? 'opacity-60' : ''}`}>
      <Languages className="w-4 h-4 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
      {!compact && <span className="sr-only">{t('common.language')}</span>}
      <select
        aria-label={t('common.language')}
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
        className={`rounded-lg border px-2 py-1 text-xs font-medium outline-none cursor-pointer ${colors}`}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="text-slate-900">
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
