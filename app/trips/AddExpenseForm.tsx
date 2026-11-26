'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { addExpense } from '../trip-actions';
import SubmitButton from '../components/SubmitButton';
import { useT } from '../components/I18nProvider';
import { EXPENSE_CATEGORIES } from '../../lib/i18n/labels';

const CATEGORIES = EXPENSE_CATEGORIES;

type Props = {
  tripId: string;
  driverName?: string | null;
  hasDriver: boolean;
  defaultPaidByDriver?: boolean;
  /** Показать или скрыть категорию "salary" (для водителя — скрыть) */
  allowSalary?: boolean;
  /** Текст подсказки над чекбоксом "оплатил водитель" */
  paidByDriverHint?: string;
};

export default function AddExpenseForm({
  tripId,
  driverName,
  hasDriver,
  defaultPaidByDriver = false,
  allowSalary = true,
  paidByDriverHint,
}: Props) {
  const { t } = useT();
  const categories = allowSalary
    ? CATEGORIES
    : CATEGORIES.filter((c) => c.value !== 'salary');

  const [category, setCategory] = useState<string>(categories[0]?.value || 'other');
  const isSalary = category === 'salary';

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <form action={addExpense} className="space-y-4">
      <input type="hidden" name="trip_id" value={tripId} />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="ae-category" className={labelClass}>{t('expense.category')}</label>
          <select id="ae-category"
            name="category"
            required
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {t(`expenseCat.${c.value}`)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ae-currency" className={labelClass}>{t('expense.currency')}</label>
          <select id="ae-currency" name="currency" className={inputClass}>
            <option value="EUR">EUR</option>
            <option value="PLN">PLN</option>
            <option value="BYN">BYN</option>
          </select>
        </div>

        <div>
          <label htmlFor="ae-amount" className={labelClass}>{t('expense.amount')}</label>
          <input id="ae-amount" type="number" name="amount" step="0.01" required className={inputClass} />
        </div>

        <div>
          <label htmlFor="ae-liters" className={labelClass}>{t('expense.liters')}</label>
          <input id="ae-liters" type="number" name="liters" step="0.01" placeholder="150" className={inputClass} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="ae-description" className={labelClass}>{t('expense.description')}</label>
          <input id="ae-description" type="text" name="description" placeholder={t('expense.comment')} className={inputClass} />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="ae-expense_date" className={labelClass}>{t('expense.date')}</label>
          <input id="ae-expense_date" type="date" name="expense_date" className={inputClass} />
        </div>

        {/* Чекбокс "оплатил водитель" — скрыт при salary */}
        {!isSalary && (
          <div className="md:col-span-2">
            <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              hasDriver
                ? 'bg-amber-50/40 border-amber-200 cursor-pointer hover:bg-amber-50'
                : 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60'
            }`}>
              <input
                type="checkbox"
                name="paid_by_driver"
                value="true"
                disabled={!hasDriver}
                defaultChecked={defaultPaidByDriver}
                className="mt-0.5 w-4 h-4 accent-amber-600"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">
                  {t('expense.paidByDriver')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {paidByDriverHint
                    ? paidByDriverHint
                    : hasDriver
                      ? t('expense.debtHint', { name: driverName ? ' — ' + driverName : '' })
                      : t('expense.noDriverHint')}
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Подсказка при salary */}
        {isSalary && (
          <div className="md:col-span-2">
            <div className="flex items-start gap-3 p-3 rounded-xl border bg-violet-50/40 border-violet-200">
              <div className="text-lg leading-none mt-0.5">💶</div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">
                  {t('expense.salaryTitle')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {hasDriver
                    ? t('expense.salaryHint', { name: driverName ? ' — ' + driverName : '' })
                    : t('expense.salaryNoDriver')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <SubmitButton
        className="btn btn-primary w-full py-3"
        pendingText={t('expense.adding')}
      >
        <PlusCircle className="w-4 h-4" strokeWidth={2.5} />
        {t('trip.addExpense')}
      </SubmitButton>
    </form>
  );
}
