'use client';

import { Receipt, Plus, Trash2, Calendar } from 'lucide-react';
import SubmitButton from '../../components/SubmitButton';
import { addForwardingExpense, deleteForwardingExpense } from '../expense-actions';

const expenseCategories: { value: string; label: string }[] = [
  { value: 'fuel', label: '⛽ Топливо' },
  { value: 'epi', label: '📄 EPI' },
  { value: 'etoll', label: '🛣 e-TOLL' },
  { value: 'border', label: '🛂 Граница' },
  { value: 'permit', label: '📋 Дозвол' },
  { value: 'tlc', label: '🏭 ТЛЦ' },
  { value: 'waiting', label: '⏳ Зона ожидания' },
  { value: 'repair', label: '🔧 Ремонт' },
  { value: 'parking', label: '🅿️ Паркинг' },
  { value: 'disinfection', label: '🧴 Дезинфекция' },
  { value: 'ex1', label: '🧾 ЕХ-1' },
  { value: 'otkat', label: '🔄 Откат' },
  { value: 'gps_seal', label: '📡 GPS пломба' },
  { value: 'other', label: '📌 Другое' },
];

function categoryLabel(cat: string): string {
  return expenseCategories.find((c) => c.value === cat)?.label || cat;
}

export default function ForwardingExpenses({
  id,
  expenses,
  totalExpenses,
}: {
  id: string;
  expenses: any[] | null;
  totalExpenses: number;
}) {
  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <>
      {/* Список расходов */}
      <div className="card p-5 md:p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand-600" />
          Доп. расходы
        </h2>

        {(!expenses || expenses.length === 0) ? (
          <div className="text-center py-6 text-slate-400 text-sm">Пока нет расходов</div>
        ) : (
          <div className="space-y-2">
            {expenses.map((exp) => (
              <div key={exp.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-semibold text-slate-800 text-sm flex-1 min-w-0 truncate">
                    {categoryLabel(exp.category)}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-slate-400">
                      {exp.original_amount} {exp.currency}
                    </div>
                    <div className="font-bold text-orange-600 text-sm">
                      {exp.amount_eur.toFixed(2)} €
                    </div>
                  </div>
                </div>
                {exp.description && (
                  <div className="text-xs text-slate-600 mb-2 break-words">
                    {exp.description}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                  <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '—'}
                  </span>
                  <form action={deleteForwardingExpense.bind(null, exp.id, id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Удалить
                    </button>
                  </form>
                </div>
              </div>
            ))}

            <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700">Итого расходов</span>
              <span className="text-lg font-bold text-orange-600">{totalExpenses.toFixed(2)} €</span>
            </div>
          </div>
        )}
      </div>

      {/* Добавить расход */}
      <div className="card p-5 md:p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-brand-600" />
          Добавить расход
        </h2>
        <form action={addForwardingExpense} className="space-y-4">
          <input type="hidden" name="forwarding_id" value={id} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelClass}>Категория</label>
              <select name="category" required className={inputClass}>
                {expenseCategories.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Валюта</label>
              <select name="currency" className={inputClass}>
                <option value="EUR">EUR</option>
                <option value="PLN">PLN</option>
                <option value="BYN">BYN</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Сумма</label>
              <input type="number" name="amount" step="0.01" required className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Дата</label>
              <input type="date" name="expense_date" className={inputClass} />
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>Описание</label>
              <input type="text" name="description" placeholder="Комментарий" className={inputClass} />
            </div>
          </div>

          <SubmitButton
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-brand transition-all duration-150 active:scale-[0.98]"
            pendingText="Добавляю расход…"
          >
            Добавить расход
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
