'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { addExpense } from '../trip-actions';
import SubmitButton from '../components/SubmitButton';

type Category = { value: string; label: string; emoji: string };

const CATEGORIES: Category[] = [
  { value: 'fuel', label: 'Топливо', emoji: '⛽' },
  { value: 'epi', label: 'EPI', emoji: '📄' },
  { value: 'border', label: 'Граница', emoji: '🛂' },
  { value: 'salary', label: 'ЗП водителя', emoji: '💶' },
  { value: 'permit', label: 'Дозвол', emoji: '📋' },
  { value: 'tlc', label: 'ТЛЦ', emoji: '🏭' },
  { value: 'waiting', label: 'Зона ожидания', emoji: '⏳' },
  { value: 'repair', label: 'Ремонт', emoji: '🔧' },
  { value: 'parking', label: 'Паркинг', emoji: '🅿️' },
  { value: 'disinfection', label: 'Дезинфекция', emoji: '🧴' },
  { value: 'ex1', label: 'ЕХ-1', emoji: '🧾' },
  { value: 'otkat', label: 'Откат', emoji: '🔄' },
  { value: 'gps_seal', label: 'GPS пломба', emoji: '📡' },
  { value: 'other', label: 'Другое', emoji: '📌' },
];

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
          <label className={labelClass}>Категория</label>
          <select
            name="category"
            required
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
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
          <label className={labelClass}>Литры (для топлива)</label>
          <input type="number" name="liters" step="0.01" placeholder="150" className={inputClass} />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Описание</label>
          <input type="text" name="description" placeholder="Комментарий" className={inputClass} />
        </div>

        <div className="md:col-span-2">
          <label className={labelClass}>Дата</label>
          <input type="date" name="expense_date" className={inputClass} />
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
                  🚛 Оплатил водитель за свои
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {paidByDriverHint
                    ? paidByDriverHint
                    : hasDriver
                      ? `Сумма уйдёт в долг водителя${driverName ? ' — ' + driverName : ''}. Погасить можно на его карточке.`
                      : 'У рейса нет водителя — сначала назначьте, потом можно отмечать.'}
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
                  Начисление ЗП за рейс
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {hasDriver
                    ? `Сумма уйдёт в долг водителя${driverName ? ' — ' + driverName : ''} как «ЗП за рейс». Погасить можно на его карточке.`
                    : 'У рейса нет водителя — ЗП не начислится.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <SubmitButton
        className="btn btn-primary w-full py-3"
        pendingText="Добавляю расход…"
      >
        <PlusCircle className="w-4 h-4" strokeWidth={2.5} />
        Добавить расход
      </SubmitButton>
    </form>
  );
}
