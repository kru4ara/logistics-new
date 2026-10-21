'use client';

import { useState } from 'react';
import { Pencil, Trash2, Receipt } from 'lucide-react';
import EditExpenseDialog from './EditExpenseDialog';
import { deleteExpenseAction } from './expense-actions';

const expenseCategories: { value: string; label: string }[] = [
  { value: 'fuel', label: '⛽ Топливо' },
  { value: 'epi', label: '📄 EPI' },
  { value: 'border', label: '🛂 Граница' },
  { value: 'salary', label: '💶 ЗП водителя' },
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
  return expenseCategories.find((c) => c.value === cat)?.label
    || (cat === 'contractor' ? '🚛 Подрядчик' : cat);
}

export default function ExpensesList({
  expenses,
  segments,
  tripId,
  totalExpenses,
}: {
  expenses: any[];
  segments: any[];
  tripId: string;
  totalExpenses: number;
}) {
  const [editingExpense, setEditingExpense] = useState<any>(null);

  return (
    <div className="card p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Расходы по рейсу
        </h2>
        {expenses && expenses.length > 0 && (
          <div className="text-sm text-slate-500">
            Итого: <b className="text-red-500 tabular-nums">{totalExpenses.toFixed(0)} €</b>
          </div>
        )}
      </div>

      {expenses?.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">Пока нет расходов</div>
      ) : (
        <>
          {/* Мобильная версия */}
          <div className="md:hidden space-y-2">
            {expenses?.map((exp: any) => {
              const seg = segments.find((s) => s.id === exp.segment_id);
              return (
                <div key={exp.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                      {categoryLabel(exp.category)}
                      {exp.paid_by_driver && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                          🚛 за счёт водителя
                        </span>
                      )}
                    </div>
                    {!seg && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingExpense(exp)}
                          className="text-slate-400 hover:text-brand-600 p-1"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <form action={deleteExpenseAction.bind(null, exp.id, tripId)}>
                          <button type="submit" className="text-red-500 hover:text-red-700 text-xs font-medium px-1">
                            Удалить
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                  {seg && (
                    <div className="text-[10px] text-brand-600 mb-1">
                      Участок #{seg.position} · {seg.executor_type === 'us' ? 'Мы' : seg.contractor_name || 'Подрядчик'} · создан автоматически
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-400">Сумма</div>
                      <div className="font-medium text-slate-700 tabular-nums">
                        {exp.original_amount} {exp.currency}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">В EUR</div>
                      <div className="font-bold text-red-500 tabular-nums">{exp.amount_eur} €</div>
                    </div>
                    {exp.description && (
                      <div className="col-span-2">
                        <div className="text-slate-400">Описание</div>
                        <div className="text-slate-700">{exp.description}</div>
                      </div>
                    )}
                    <div className="col-span-2 text-right text-slate-400">
                      {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Десктопная версия */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Категория</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Оплачено</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">В EUR</th>
                  <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Описание</th>
                  <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Дата</th>
                  <th className="py-3 pl-2"></th>
                </tr>
              </thead>
              <tbody>
                {expenses?.map((exp: any) => {
                  const seg = segments.find((s) => s.id === exp.segment_id);
                  return (
                    <tr key={exp.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-2 flex-wrap font-medium text-slate-800">
                            {categoryLabel(exp.category)}
                            {exp.paid_by_driver && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                                🚛 за счёт водителя
                              </span>
                            )}
                          </span>
                          {seg && (
                            <span className="text-[11px] text-brand-600 bg-brand-50 self-start px-1.5 rounded">
                              #{seg.position} {seg.executor_type === 'us' ? 'Мы' : seg.contractor_name || ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-medium text-slate-600 tabular-nums whitespace-nowrap">
                        {exp.original_amount} {exp.currency}
                      </td>
                      <td className="py-3 px-3 text-right text-sm font-bold text-red-500 tabular-nums whitespace-nowrap">
                        {exp.amount_eur} €
                      </td>
                      <td className="py-3 px-3 text-sm text-slate-500 max-w-[250px] truncate" title={exp.description}>
                        {exp.description || '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-slate-400 tabular-nums whitespace-nowrap">
                        {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td className="py-3 pl-2 text-right">
                        {!seg && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingExpense(exp)}
                              className="text-slate-400 hover:text-brand-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Редактировать"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <form action={deleteExpenseAction.bind(null, exp.id, tripId)}>
                              <button type="submit" className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Удалить">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingExpense && (
        <EditExpenseDialog expense={editingExpense} onClose={() => setEditingExpense(null)} />
      )}
    </div>
  );
}
