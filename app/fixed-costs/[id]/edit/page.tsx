import { createClient } from '../../../../lib/supabase-server';
import { updateFixedCost } from '../../../fixed-cost-actions';
import SubmitButton from '../../../components/SubmitButton';
import { ArrowLeft, Banknote, Pencil, Save } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EditFixedCostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: costId } = await params;

  const supabase = await createClient();

  const { data: cost, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .eq('id', costId)
    .single();

  if (error) return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;

  const currentAmount = cost.original_amount ?? cost.amount_pln ?? cost.amount_eur ?? 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/fixed-costs"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все общие расходы
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Pencil className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Редактировать расход
          </h1>
        </div>

        <form action={updateFixedCost.bind(null, costId)} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Данные расхода
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Месяц *</label>
                <input
                  type="month"
                  name="month_key"
                  required
                  defaultValue={cost.month_key || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата расхода *</label>
                <input
                  type="date"
                  name="expense_date"
                  required
                  defaultValue={cost.expense_date || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Тип расхода *</label>
                <select
                  name="cost_type"
                  required
                  defaultValue={cost.cost_type || 'monthly'}
                  className="input"
                >
                  <option value="yearly">Годовой</option>
                  <option value="monthly">Месячный</option>
                  <option value="installment">Рата (часть платежа)</option>
                  <option value="one_time">Одноразовый</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категория *</label>
                <input
                  type="text"
                  name="category"
                  required
                  defaultValue={cost.category || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Валюта *</label>
                <select
                  name="currency"
                  required
                  defaultValue={cost.currency || 'PLN'}
                  className="input"
                >
                  <option value="PLN">PLN</option>
                  <option value="BYN">BYN</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Сумма *</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  required
                  defaultValue={currentAmount}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href="/fixed-costs"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText="Сохраняю изменения…"
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Сохранить изменения
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
