'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { classifySeller, setInvoiceOverhead } from './actions';
import type { CategoryOption } from './PayablesControls';

/**
 * Разобрать все счета продавца: «это расходы рейсов» (вернуть в привязку) или категория
 * накладных. CRM запоминает выбор для новых счетов этого продавца.
 */
export function SellerSortForm({ sellerKey, count, categories, initial, guessed }: {
  sellerKey: string;
  count: number;
  categories: CategoryOption[];
  initial: string;
  guessed: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [value, setValue] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const apply = () =>
    start(async () => {
      const r = await classifySeller(sellerKey, value === 'trip' ? 'trip' : 'overhead', value === 'trip' ? undefined : value);
      setMsg(r.message ? { ok: r.ok, text: r.message } : null);
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <select value={value} onChange={(e) => setValue(e.target.value)} aria-label={t('payx3.whatIs')}
          className={`input text-sm py-1.5 ${value ? '' : 'border-amber-400 bg-amber-50'}`}>
          <option value="">{t('payx3.whatIs')}</option>
          <option value="trip">🚛 {t('payx3.toTrips')}</option>
          <optgroup label={t('payx3.overhead')}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </optgroup>
        </select>
        <button type="button" disabled={isPending || !value} onClick={apply} className="btn btn-primary text-xs px-2.5 py-1.5 disabled:opacity-50">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {t('payx3.applyAll', { n: count })}
        </button>
        {guessed && <span className="text-xs text-slate-400">{t('payx3.guessed')}</span>}
      </div>
      {msg && <p className={`text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

/** Категория одного счёта внутри группы (например, e-TOLL среди счетов Logisat). */
export function InvoiceOverheadSelect({ invoiceId, value, categories }: { invoiceId: string; value: string; categories: CategoryOption[] }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <select defaultValue={value} disabled={isPending} aria-label={t('payx3.category')}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          start(async () => {
            const r = await setInvoiceOverhead(invoiceId, v);
            setErr(r.ok ? null : r.message ?? null);
            router.refresh();
          });
        }}
        className={`input text-xs py-0.5 px-1.5 disabled:opacity-50 ${value ? '' : 'border-amber-300'}`}>
        <option value="">{t('payx3.noCategory')}</option>
        {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      {err && <span className="text-red-600">{err}</span>}
    </span>
  );
}
