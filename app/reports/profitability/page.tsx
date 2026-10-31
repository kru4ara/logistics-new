import { getSessionContext } from '../../../lib/session';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Coins,
  Handshake,
  Truck,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { calculateProfitability, toNum, getOrderPeriodDate } from '../../../lib/profitability';

export const dynamic = 'force-dynamic';

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function firstDayOfYearIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProfitabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const resolvedParams = await searchParams;
  const from = resolvedParams.from || firstDayOfYearIso();
  const to = resolvedParams.to || todayIso();

  const supabase = await createClient();

  // ЗАКАЗЫ (рейсы + экспедиции)
  const { data: orders } = await supabase
    .from('trips')
    .select(`
      id, client_id, truck_id, revenue_eur, actual_km, start_date,
      end_date, load_date, unload_date, profit_mode,
      clients(name),
      trucks!truck_id(registration_number)
    `);

  const filteredOrders = (orders || []).filter((o: any) => {
    const d = getOrderPeriodDate(o);
    if (!d) return false;
    return d >= from && d <= to;
  });

  const orderIds = filteredOrders.map((o: any) => o.id).filter(Boolean);

  // Расходы заказов
  const expensesByOrder: Record<string, number> = {};
  if (orderIds.length > 0) {
    const { data: exp } = await supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur')
      .in('trip_id', orderIds);
    (exp || []).forEach((e: any) => {
      if (!e.trip_id) return;
      expensesByOrder[e.trip_id] = (expensesByOrder[e.trip_id] || 0) + toNum(e.amount_eur);
    });
  }

  // Подрядчики заказов
  const contractorByOrder: Record<string, number> = {};
  if (orderIds.length > 0) {
    const { data: segs } = await supabase
      .from('trip_segments')
      .select('trip_id, price, executor_type')
      .in('trip_id', orderIds)
      .eq('executor_type', 'contractor');
    (segs || []).forEach((s: any) => {
      if (!s.trip_id) return;
      contractorByOrder[s.trip_id] = (contractorByOrder[s.trip_id] || 0) + toNum(s.price);
    });
  }

  // РАСЧЁТ
  const {
    clientRows,
    truckRows,
    totalRevenue,
    totalExpenses,
    totalProfit,
    totalMargin,
  } = calculateProfitability({
    orders: filteredOrders,
    expensesByOrder,
    contractorByOrder,
  });

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link
          href="/reports"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Отчёты
        </Link>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-7 h-7 text-brand-600" />
            Прибыльность
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Кто из клиентов и какая техника приносят деньги
          </p>
        </div>

        {/* Фильтр по периоду */}
        <form className="card p-4 md:p-5" method="GET">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 items-end">
            <div>
              <label className={labelClass}>С даты</label>
              <input type="date" name="from" defaultValue={from} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>По дату</label>
              <input type="date" name="to" defaultValue={to} className={inputClass} />
            </div>
            <div className="col-span-2 md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition-all active:scale-[0.98]"
              >
                Показать
              </button>
              <Link
                href="/reports/profitability"
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-all whitespace-nowrap"
              >
                Сброс
              </Link>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-3">
            Рейсы — по дате старта, экспедирование — по дате загрузки.
          </div>
        </form>

        {/* Общие итоги */}
        <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-4">
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Сделок</div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
              {clientRows.reduce((s, r) => s + r.count, 0)}
            </div>
          </div>
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Доход</div>
            <div className="text-xl md:text-2xl font-bold text-green-600 break-words tabular-nums">
              {fmt(totalRevenue)} €
            </div>
          </div>
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Расходы</div>
            <div className="text-xl md:text-2xl font-bold text-red-500 break-words tabular-nums">
              {fmt(totalExpenses)} €
            </div>
          </div>
          <div className="card p-4 md:p-5">
            <div className="text-xs md:text-sm text-slate-500 font-medium mb-2">Прибыль / маржа</div>
            <div className={`text-xl md:text-2xl font-bold break-words tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmt(totalProfit)} €
            </div>
            <div className="text-xs text-slate-400 mt-1 tabular-nums">маржа {fmtPct(totalMargin)}</div>
          </div>
        </div>

        {/* ПРИБЫЛЬНОСТЬ КЛИЕНТОВ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Handshake className="w-5 h-5 text-brand-600" />
            Прибыльность клиентов
          </h2>

          {clientRows.length === 0 ? (
            <div className="card p-10 md:p-14 text-center animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Handshake className="w-8 h-8 text-brand-600" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Нет данных за период
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Попробуйте расширить диапазон дат — возможно, за это время сделок не было.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {clientRows.map((r, i) => (
                  <div
                    key={`${r.name}-${r.type}-${i}`}
                    className="card p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-sm break-words">
                          {r.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {r.type} · {r.count} сделок
                        </div>
                      </div>
                      <span className={`shrink-0 font-bold text-sm whitespace-nowrap tabular-nums ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmt(r.profit)} €
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-slate-400">Доход</div>
                        <div className="font-semibold text-green-600 tabular-nums">{fmt(r.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Расходы</div>
                        <div className="font-semibold text-red-500 tabular-nums">{fmt(r.expenses)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Маржа</div>
                        <div className={`font-semibold tabular-nums ${r.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {fmtPct(r.margin)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Клиент</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Тип</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Сделок</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Доход</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientRows.map((r, i) => (
                        <tr key={`${r.name}-${r.type}-${i}`} className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800 break-words">
                            {r.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.type === 'Заказы' ? 'bg-brand-50 text-brand-700' : 'bg-purple-50 text-purple-700'}`}>
                              {r.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{r.count}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap tabular-nums">
                            {fmt(r.revenue)} €
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-red-500 whitespace-nowrap tabular-nums">
                            {fmt(r.expenses)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-bold whitespace-nowrap tabular-nums ${r.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt(r.profit)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap tabular-nums ${r.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmtPct(r.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ПРИБЫЛЬНОСТЬ МАШИН */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-600" />
            Прибыльность тягачей (по рейсам)
          </h2>

          {truckRows.length === 0 ? (
            <div className="card p-10 md:p-14 text-center animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Truck className="w-8 h-8 text-brand-600" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Нет данных за период
              </h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                За выбранный период не было рейсов с назначенным тягачом.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {truckRows.map((t) => (
                  <div key={t.id} className="card p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-sm">
                          {t.registration}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                          {t.count} рейсов · {fmt(t.km)} км
                        </div>
                      </div>
                      <span className={`shrink-0 font-bold text-sm whitespace-nowrap tabular-nums ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmt(t.profit)} €
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100">
                      <div>
                        <div className="text-slate-400">Фрахт</div>
                        <div className="font-semibold text-green-600 tabular-nums">{fmt(t.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Расходы</div>
                        <div className="font-semibold text-red-500 tabular-nums">{fmt(t.expenses)}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Маржа</div>
                        <div className={`font-semibold tabular-nums ${t.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {fmtPct(t.margin)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Тягач</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Пробег, км</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маржа</th>
                      </tr>
                    </thead>
                    <tbody>
                      {truckRows.map((t) => (
                        <tr key={t.id} className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{t.registration}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">{t.count}</td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600 whitespace-nowrap tabular-nums">{fmt(t.km)}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-green-600 whitespace-nowrap tabular-nums">
                            {fmt(t.revenue)} €
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-red-500 whitespace-nowrap tabular-nums">
                            {fmt(t.expenses)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-bold whitespace-nowrap tabular-nums ${t.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmt(t.profit)} €
                          </td>
                          <td className={`px-4 py-3 text-right text-sm font-semibold whitespace-nowrap tabular-nums ${t.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmtPct(t.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
