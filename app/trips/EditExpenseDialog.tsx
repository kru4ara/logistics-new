'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Save, Loader2 } from 'lucide-react';
import { updateExpense } from '../trip-actions';
import { useT } from '../components/I18nProvider';
import { EXPENSE_CATEGORIES } from '../../lib/i18n/labels';

export default function EditExpenseDialog({
  expense,
  onClose,
}: {
  expense: any;
  onClose: () => void;
}) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const categories = EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: `${c.emoji} ${t(`expenseCat.${c.value}`)}` }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      try {
        await updateExpense(expense.id, formData);
        router.refresh();
        onClose();
      } catch (err: any) {
        setError(err.message || t('seg.saveError'));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={() => !isPending && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 md:p-6 space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold text-slate-900">{t('expense.editTitle')}</h3>
          <button onClick={onClose} disabled={isPending} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="hidden" name="trip_id" value={expense.trip_id} />
          
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.category')}</label>
            <select name="category" defaultValue={expense.category} className="input text-sm py-1.5">
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.amount')}</label>
              <input type="number" step="0.01" name="original_amount" defaultValue={expense.original_amount} className="input text-sm py-1.5" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.currency')}</label>
              <select name="currency" defaultValue={expense.currency} className="input text-sm py-1.5">
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
                <option value="BYN">BYN</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.inEur')}</label>
            <input type="number" step="0.01" name="amount_eur" defaultValue={expense.amount_eur} className="input text-sm py-1.5" required />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.date')}</label>
            <input type="date" name="expense_date" defaultValue={expense.expense_date} className="input text-sm py-1.5" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('expense.description')}</label>
            <input type="text" name="description" defaultValue={expense.description} className="input text-sm py-1.5" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="paid_by_driver" defaultChecked={expense.paid_by_driver} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            {t('expense.paidByDriverShort')}
          </label>

          {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={isPending} className="btn btn-secondary flex-1">{t('seg.cancel')}</button>
            <button type="submit" disabled={isPending} className="btn btn-primary flex-1 flex justify-center gap-2">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
