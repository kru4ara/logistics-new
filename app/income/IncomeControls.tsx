'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { addOtherIncome, deleteOtherIncome } from './actions';
import { confirmDialog } from '../components/Dialogs';

type Opt = { value: string; label: string };

/** Форма «Добавить доход» (вручную, без операции в выписке). */
export function AddIncomeForm({ categories, today }: { categories: Opt[]; today: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end"
      action={(fd) =>
        start(async () => {
          setErr(null);
          const r = await addOtherIncome(fd);
          if (!r.ok) setErr(r.message ?? null);
          else router.refresh();
        })
      }
    >
      <label className="block">
        <span className="block text-xs text-slate-600 mb-0.5">{t('income.date')}</span>
        <input type="date" name="income_date" defaultValue={today} required className="input text-sm" />
      </label>
      <label className="block">
        <span className="block text-xs text-slate-600 mb-0.5">{t('income.amount')}</span>
        <input name="amount" inputMode="decimal" required className="input text-sm" />
      </label>
      <label className="block">
        <span className="block text-xs text-slate-600 mb-0.5">{t('income.currency')}</span>
        <select name="currency" defaultValue="EUR" className="input text-sm">
          {['EUR', 'PLN', 'BYN', 'USD'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="block text-xs text-slate-600 mb-0.5">{t('income.category')}</span>
        <select name="category" defaultValue="compensation" className="input text-sm">
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <label className="block col-span-2 md:col-span-1">
        <span className="block text-xs text-slate-600 mb-0.5">{t('income.description')}</span>
        <input name="description" maxLength={300} className="input text-sm" />
      </label>
      <button type="submit" disabled={isPending} className="btn btn-primary text-sm disabled:opacity-50 col-span-2 md:col-span-1">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {t('income.add')}
      </button>
      {err && <p className="col-span-full text-sm text-red-600">{err}</p>}
    </form>
  );
}

/** Удалить ручной доход. */
export function DeleteIncomeButton({ id, name }: { id: string; name: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={isPending}
        title={t('income.delete')}
        aria-label={t('income.delete')}
        onClick={async () => {
          if (!(await confirmDialog(t('income.confirmDelete', { name }), { danger: true }))) return;
          start(async () => {
            const r = await deleteOtherIncome(id);
            if (!r.ok) setErr(r.message ?? null);
            else router.refresh();
          });
        }}
        className="text-slate-400 hover:text-red-600 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
      {err && <span className="text-[11px] text-red-600 max-w-xs">{err}</span>}
    </span>
  );
}
