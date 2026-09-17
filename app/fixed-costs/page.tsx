import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { deleteFixedCost } from '../fixed-cost-actions';

export const dynamic = 'force-dynamic';

type MonthGroup = {
  month_key: string;
  items: any[];
  total: number;
};

export default async function FixedCostsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: costs, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .order('month_key', { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const yearlyTotal = costs?.filter(c => c.cost_type === 'yearly').reduce((sum, c) => sum + (c.amount_eur || 0), 0) || 0;
  const currentMonthCosts = costs?.filter(c => c.month_key === currentMonthKey) || [];
  const currentMonthActual = currentMonthCosts.reduce((sum, c) => sum + (c.amount_eur || 0), 0);
  const currentMonthYearlyPart = currentMonthCosts.filter(c => c.cost_type === 'yearly').reduce((sum, c) => sum + (c.amount_eur || 0), 0);
  const effectiveMonthly = currentMonthActual - currentMonthYearlyPart + (yearlyTotal / 12);

  const costsByMonth: Record<string, MonthGroup> = {};
  costs?.forEach((c) => {
    if (!c.month_key) return;
    if (!costsByMonth[c.month_key]) {
      costsByMonth[c.month_key] = { month_key: c.month_key, items: [], total: 0 };
    }
    costsByMonth[c.month_key].items.push(c);
    costsByMonth[c.month_key].total += c.amount_eur || 0;
  });

  const months: MonthGroup[] = Object.values(costsByMonth);

  const typeLabels: Record<string, { label: string; color: string }> = {
    yearly: { label: '📅 Годовой', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    monthly: { label: '🔄 Месячный', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    installment: { label: '💰 Рата', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    one_time: { label: '⚡ Одноразовый', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  };

  const currencySymbol: Record<string, string> = {
    PLN: 'PLN',
    BYN: 'BYN',
    EUR: '€',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">💶 Общие расходы</h1>
            <p className="text-slate-500 mt-1">Расходы, не привязанные к конкретному рейсу — по месяцам</p>
          </div>
          <a
            href="/fixed-costs/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Добавить расход</span>
          </a>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">В этом месяце (факт)</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">💸</div>
            </div>
            <div className="text-3xl font-bold text-red-500">{currentMonthActual.toFixed(2)} €</div>
            <div className="text-xs text-slate-400 mt-1">Все расходы, привязанные к текущему месяцу</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Эффективно в месяц</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">📊</div>
            </div>
            <div className="text-3xl font-bold text-emerald-600">{effectiveMonthly.toFixed(2)} €</div>
            <div className="text-xs text-slate-400 mt-1">
              Годовые ÷ 12 ({yearlyTotal.toFixed(0)} € / год) + текущие месячные
            </div>
          </div>
        </div>

        {months.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">💶</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Расходов пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первый общий расход</p>
          </div>
        ) : (
          <div className="space-y-5">
            {months.map((m) => (
              <div key={m.month_key} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📅</div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {new Date(m.month_key + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </h2>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Итого за месяц</div>
                    <div className="text-xl font-bold text-red-500">{m.total.toFixed(2)} €</div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Дата</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Категория</th>
                        <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Тип</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Сумма</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">В EUR</th>
                        <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.items.map((c: any) => {
                        const t = c.cost_type && typeLabels[c.cost_type] ? typeLabels[c.cost_type] : null;
                        const originalAmount = c.original_amount ?? c.amount_pln ?? c.amount_eur ?? 0;
                        const curr = c.currency || 'PLN';
                        return (
                          <tr key={c.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {c.expense_date ? new Date(c.expense_date).toLocaleDateString('ru-RU') : '—'}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800">
                              {c.category || 'Без категории'}
                            </td>
                            <td className="px-6 py-4">
                              {t ? (
                                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${t.color}`}>
                                  {t.label}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-700 font-medium whitespace-nowrap">
                              {originalAmount} {currencySymbol[curr] || curr}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-red-500 whitespace-nowrap">
                              {c.amount_eur ? `${Number(c.amount_eur).toFixed(2)} €` : '—'}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <a
                                href={`/fixed-costs/${c.id}/edit`}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1"
                              >
                                ✏️
                              </a>
                              <form action={async () => {
                                'use server';
                                await deleteFixedCost(c.id);
                              }} className="inline">
                                <button
                                  type="submit"
                                  className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1"
                                >
                                  🗑️
                                </button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
