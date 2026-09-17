import { supabase } from '../../../../lib/supabaseClient';
import { updateFixedCost } from '../../../fixed-cost-actions';

export const dynamic = 'force-dynamic';

export default async function EditFixedCostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: costId } = await params;
  const { data: cost, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .eq('id', costId)
    .single();

  if (error) return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  const currentAmount = cost.original_amount ?? cost.amount_pln ?? cost.amount_eur ?? 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <a href="/fixed-costs" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все общие расходы
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать расход</h1>
        </div>

        <form action={updateFixedCost.bind(null, costId)} className="space-y-6">
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>💶 Данные расхода</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Месяц *</label>
                <input type="month" name="month_key" required defaultValue={cost.month_key || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Тип расхода *</label>
                <select name="cost_type" required defaultValue={cost.cost_type || 'monthly'} className={inputClass}>
                  <option value="yearly">📅 Годовой</option>
                  <option value="monthly">🔄 Месячный</option>
                  <option value="installment">💰 Рата (часть платежа)</option>
                  <option value="one_time">⚡ Одноразовый</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Категория *</label>
                <input type="text" name="category" required defaultValue={cost.category || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Валюта *</label>
                <select name="currency" required defaultValue={cost.currency || 'PLN'} className={inputClass}>
                  <option value="PLN">PLN</option>
                  <option value="BYN">BYN</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Сумма *</label>
                <input type="number" name="amount" step="0.01" required defaultValue={currentAmount} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить изменения
            </button>
            <a
              href="/fixed-costs"
              className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}
