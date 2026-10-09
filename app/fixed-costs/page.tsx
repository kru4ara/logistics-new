import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { deleteFixedCost } from '../fixed-cost-actions';
import {
  Banknote,
  Plus,
  Calendar,
  TrendingDown,
  BarChart3,
  Inbox,
  Briefcase,
  Pencil,
  Trash2,
  Repeat,
  CalendarClock,
  Coins,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type MonthGroup = {
  month_key: string;
  items: any[];
  total: number;
  capexTotal: number;
  operationalTotal: number;
};

const costTypeMeta: Record<string, { label: string; Icon: LucideIcon; badge: string }> = {
  yearly: { label: 'Годовой', Icon: CalendarClock, badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  monthly: { label: 'Месячный', Icon: Repeat, badge: 'bg-brand-50 text-brand-700 border-brand-200' },
  installment: { label: 'Рата', Icon: Coins, badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  one_time: { label: 'Одноразовый', Icon: Zap, badge: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const currencySymbol: Record<string, string> = {
  PLN: 'PLN',
  BYN: 'BYN',
  EUR: '€',
};

export default async function FixedCostsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: costs, error } = await supabase
    .from('fixed_costs')
    .select('*')
    .order('month_key', { ascending: false })
    .order('expense_date', { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Операционные vs инвестиции
  const operationalCosts = costs?.filter((c) => !c.is_capex) || [];
  const capexCosts = costs?.filter((c) => c.is_capex) || [];

  const yearlyTotal = operationalCosts
    .filter((c) => c.cost_type === 'yearly')
    .reduce((sum, c) => sum + (c.amount_eur || 0), 0);

  const currentMonthOperational = operationalCosts.filter((c) => c.month_key === currentMonthKey);
  const currentMonthActual = currentMonthOperational.reduce((sum, c) => sum + (c.amount_eur || 0), 0);
  const currentMonthYearlyPart = currentMonthOperational
    .filter((c) => c.cost_type === 'yearly')
    .reduce((sum, c) => sum + (c.amount_eur || 0), 0);
  const effectiveMonthly = currentMonthActual - currentMonthYearlyPart + yearlyTotal / 12;

  const totalCapexAllTime = capexCosts.reduce((sum, c) => sum + (c.amount_eur || 0), 0);

  // Группировка по месяцам (операционные + капекс отдельно)
  const costsByMonth: Record<string, MonthGroup> = {};
  costs?.forEach((c) => {
    if (!c.month_key) return;
    if (!costsByMonth[c.month_key]) {
      costsByMonth[c.month_key] = {
        month_key: c.month_key,
        items: [],
        total: 0,
        capexTotal: 0,
        operationalTotal: 0,
      };
    }
    const amount = c.amount_eur || 0;
    costsByMonth[c.month_key].items.push(c);
    costsByMonth[c.month_key].total += amount;
    if (c.is_capex) {
      costsByMonth[c.month_key].capexTotal += amount;
    } else {
      costsByMonth[c.month_key].operationalTotal += amount;
    }
  });

  Object.values(costsByMonth).forEach((group) => {
    group.items.sort((a, b) => {
      const da = a.expense_date ? new Date(a.expense_date).getTime() : 0;
      const db = b.expense_date ? new Date(b.expense_date).getTime() : 0;
      if (db !== da) return db - da;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });
  });

  const months: MonthGroup[] = Object.values(costsByMonth);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Banknote className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Общие расходы
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Расходы, не привязанные к конкретному рейсу
            </p>
          </div>
          <a href="/fixed-costs/new" className="btn btn-primary text-sm md:text-base w-full sm:w-auto justify-center">
            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            Добавить расход
          </a>
        </div>

        {/* Счётчики */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">В этом месяце (факт)</span>
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-500" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-500 break-words tabular-nums">
              {currentMonthActual.toFixed(0)} €
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Операционные (без инвестиций)
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-slate-500">Эффективно в месяц</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 break-words tabular-nums">
              {effectiveMonthly.toFixed(0)} €
            </div>
            <div className="text-xs text-slate-400 mt-1 break-words">
              Годовые ÷ 12 ({yearlyTotal.toFixed(0)} € / год)
            </div>
          </div>

          <div className="card p-4 md:p-5 border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium text-amber-700">Инвестиции (всего)</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-amber-600 break-words tabular-nums">
              {totalCapexAllTime > 0 ? `${totalCapexAllTime.toFixed(0)} €` : '—'}
            </div>
            <div className="text-xs text-amber-600/70 mt-1">
              вне P&L · {capexCosts.length} {capexCosts.length === 1 ? 'операция' : 'операций'}
            </div>
          </div>
        </div>

        {months.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Расходов пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первый общий расход</p>
          </div>
        ) : (
          <div className="space-y-4 md:space-y-5">
            {months.map((m) => (
              <div key={m.month_key} className="card overflow-hidden">
                <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 md:w-5 md:h-5 text-brand-600" strokeWidth={2} />
                    </div>
                    <h2 className="text-base md:text-lg font-bold text-slate-900 capitalize">
                      {new Date(m.month_key + '-01').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                    </h2>
                  </div>
                  <div className="flex items-baseline gap-4">
                    {m.capexTotal > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] md:text-xs uppercase tracking-wide text-amber-600 font-medium">Инвестиции</div>
                        <div className="text-sm md:text-base font-bold text-amber-600 tabular-nums">{m.capexTotal.toFixed(0)} €</div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-[10px] md:text-xs uppercase tracking-wide text-slate-400 font-medium">Операционные</div>
                      <div className="text-lg md:text-xl font-bold text-red-500 tabular-nums">{m.operationalTotal.toFixed(0)} €</div>
                    </div>
                  </div>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                  {m.items.map((c: any) => {
                    const meta = c.cost_type && costTypeMeta[c.cost_type] ? costTypeMeta[c.cost_type] : null;
                    const originalAmount = c.original_amount ?? c.amount_pln ?? c.amount_eur ?? 0;
                    const curr = c.currency || 'PLN';
                    const isCapex = c.is_capex === true;
                    return (
                      <div key={c.id} className={`p-4 space-y-2 ${isCapex ? 'bg-amber-50/30' : ''}`}>
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <div className="font-semibold text-slate-800 break-words">
                                {c.category || 'Без категории'}
                              </div>
                              {isCapex && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                  <Briefcase className="w-2.5 h-2.5" strokeWidth={2.5} />
                                  Инвестиция
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Calendar className="w-3 h-3" strokeWidth={2} />
                              <span className="tabular-nums">
                                {c.expense_date ? new Date(c.expense_date).toLocaleDateString('ru-RU') : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-slate-400 tabular-nums">
                              {originalAmount} {currencySymbol[curr] || curr}
                            </div>
                            <div className={`font-bold break-words tabular-nums ${isCapex ? 'text-amber-600' : 'text-red-500'}`}>
                              {c.amount_eur ? `${Number(c.amount_eur).toFixed(0)} €` : '—'}
                            </div>
                          </div>
                        </div>

                        {meta && (
                          <div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badge}`}>
                              <meta.Icon className="w-3 h-3" strokeWidth={2.2} />
                              {meta.label}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <a
                            href={`/fixed-costs/${c.id}/edit`}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-100 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                            Изменить
                          </a>
                          <form action={async () => {
                            'use server';
                            await deleteFixedCost(c.id);
                          }} className="flex-1">
                            <button
                              type="submit"
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30 text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                              Удалить
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
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
                        const meta = c.cost_type && costTypeMeta[c.cost_type] ? costTypeMeta[c.cost_type] : null;
                        const originalAmount = c.original_amount ?? c.amount_pln ?? c.amount_eur ?? 0;
                        const curr = c.currency || 'PLN';
                        const isCapex = c.is_capex === true;
                        return (
                          <tr key={c.id} className={`border-b border-slate-50 transition-colors ${isCapex ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-brand-50/30'}`}>
                            <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap tabular-nums">
                              {c.expense_date ? new Date(c.expense_date).toLocaleDateString('ru-RU') : '—'}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                {c.category || 'Без категории'}
                                {isCapex && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                    <Briefcase className="w-2.5 h-2.5" strokeWidth={2.5} />
                                    Инвестиция
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {meta ? (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${meta.badge}`}>
                                  <meta.Icon className="w-3 h-3" strokeWidth={2.2} />
                                  {meta.label}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-700 font-medium whitespace-nowrap tabular-nums">
                              {originalAmount} {currencySymbol[curr] || curr}
                            </td>
                            <td className={`px-6 py-4 text-right font-semibold whitespace-nowrap tabular-nums ${isCapex ? 'text-amber-600' : 'text-red-500'}`}>
                              {c.amount_eur ? `${Number(c.amount_eur).toFixed(0)} €` : '—'}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <a
                                href={`/fixed-costs/${c.id}/edit`}
                                className="text-brand-600 hover:text-brand-800 text-xs font-medium px-2 py-1 inline-flex"
                                title="Изменить"
                              >
                                <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                              </a>
                              <form action={async () => {
                                'use server';
                                await deleteFixedCost(c.id);
                              }} className="inline">
                                <button
                                  type="submit"
                                  className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1"
                                  title="Удалить"
                                >
                                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
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
