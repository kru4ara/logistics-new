import Link from 'next/link';
import { createClient } from '../../../lib/supabase-server';
import { buildRouteMap, type SegmentRouteRow } from '../../../lib/trip-route';
import { ArrowLeft, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ExportPage() {
  const supabase = await createClient();

  const [tripsResult, expensesResult, segmentsResult] = await Promise.all([
    supabase
      .from('trips')
      .select('id, revenue_eur'),
    supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur'),
    supabase
      .from('trip_segments')
      .select('trip_id, position, from_city, from_country, to_city, to_country'),
  ]);

  const trips = tripsResult.data || [];
  const expenses = expensesResult.data || [];
  const segments = (segmentsResult.data || []) as SegmentRouteRow[];

  const routeByTrip = buildRouteMap(segments);

  const expensesByTrip = expenses.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>);

  type RouteAgg = {
    route: string;
    revenue: number;
    expenses: number;
    count: number;
  };

  const routeMap = new Map<string, RouteAgg>();

  for (const trip of trips) {
    const info = routeByTrip.get(trip.id);
    const route = info?.route || null;
    if (!route) continue;

    const existing = routeMap.get(route);
    const tripRevenue = trip.revenue_eur || 0;
    const tripExpenses = expensesByTrip[trip.id] || 0;

    if (existing) {
      existing.revenue += tripRevenue;
      existing.expenses += tripExpenses;
      existing.count += 1;
    } else {
      routeMap.set(route, {
        route,
        revenue: tripRevenue,
        expenses: tripExpenses,
        count: 1,
      });
    }
  }

  const routes = Array.from(routeMap.values()).sort(
    (a, b) => b.revenue - a.revenue
  );

  const totalRevenue = routes.reduce((sum, r) => sum + r.revenue, 0);
  const totalExpenses = routes.reduce((sum, r) => sum + r.expenses, 0);
  const profit = totalRevenue - totalExpenses;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Download className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Отчёт для бухгалтера
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Сводка по маршрутам · всего: <b className="text-slate-700">{routes.length}</b>
            </p>
          </div>
          <Link
            href="/routes"
            className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700
                       font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
            Назад
          </Link>
        </div>

        {/* Таблица */}
        <div className="card overflow-hidden">
          {routes.length === 0 ? (
            <div className="p-10 md:p-16 text-center">
              <p className="text-slate-400 text-sm">Маршрутов пока нет</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 md:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маршрут</th>
                    <th className="text-right px-4 md:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Выручка (€)</th>
                    <th className="text-right px-4 md:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы (€)</th>
                    <th className="text-right px-4 md:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль (€)</th>
                    <th className="text-right px-4 md:px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => {
                    const rProfit = r.revenue - r.expenses;
                    return (
                      <tr key={r.route} className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors">
                        <td className="px-4 md:px-6 py-4 font-medium text-slate-800 break-words">
                          {r.route}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-right font-semibold text-green-600 whitespace-nowrap tabular-nums">
                          {r.revenue.toFixed(2)} €
                        </td>
                        <td className="px-4 md:px-6 py-4 text-right font-semibold text-red-500 whitespace-nowrap tabular-nums">
                          {r.expenses.toFixed(2)} €
                        </td>
                        <td className={`px-4 md:px-6 py-4 text-right font-bold whitespace-nowrap tabular-nums ${rProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {rProfit.toFixed(2)} €
                        </td>
                        <td className="px-4 md:px-6 py-4 text-right text-slate-600 tabular-nums">
                          {r.count}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-bold">
                    <td className="px-4 md:px-6 py-4 text-slate-900">Общий итог</td>
                    <td className="px-4 md:px-6 py-4 text-right text-green-600 whitespace-nowrap tabular-nums">
                      {totalRevenue.toFixed(2)} €
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right text-red-500 whitespace-nowrap tabular-nums">
                      {totalExpenses.toFixed(2)} €
                    </td>
                    <td className={`px-4 md:px-6 py-4 text-right whitespace-nowrap tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {profit.toFixed(2)} €
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right text-slate-600 tabular-nums">
                      {routes.reduce((sum, r) => sum + r.count, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Кнопка внизу */}
        <div className="flex justify-start">
          <Link
            href="/routes"
            className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700
                       font-semibold px-4 py-2.5 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
            Назад
          </Link>
        </div>

      </div>
    </main>
  );
}
