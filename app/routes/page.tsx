import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import DownloadButton from './DownloadButton';

export const dynamic = 'force-dynamic';

export default async function RoutesPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: trips, error } = await supabase
    .from('trips')
    .select('route, revenue_eur, id');

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  const routes = trips?.reduce((acc, trip) => {
    if (!trip.route) return acc;
    const existing = acc.find((r) => r.route === trip.route);
    if (existing) {
      existing.revenue += trip.revenue_eur || 0;
      existing.count += 1;
    } else {
      acc.push({ route: trip.route, revenue: trip.revenue_eur || 0, count: 1 });
    }
    return acc;
  }, [] as Array<{ route: string; revenue: number; count: number }>) || [];

  const routesWithExpenses = routes.map((route) => {
    const tripIds = trips?.filter((t) => t.route === route.route).map((t) => t.id) || [];
    const routeExpenses = expensesByTrip
      ? Object.entries(expensesByTrip)
          .filter(([tripId]) => tripIds.includes(tripId))
          .reduce((sum, [, amount]) => sum + amount, 0)
      : 0;
    return { ...route, expenses: routeExpenses };
  });

  const totalRevenue = routesWithExpenses.reduce((sum, r) => sum + r.revenue, 0);
  const totalExpenses = routesWithExpenses.reduce((sum, r) => sum + r.expenses, 0);
  const profit = totalRevenue - totalExpenses;

  const sortedRoutes = [...routesWithExpenses].sort((a, b) => b.revenue - a.revenue);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">🛣 Маршруты</h1>
            <p className="text-slate-500 mt-1">Всего маршрутов: {sortedRoutes.length}</p>
          </div>
          <DownloadButton data={sortedRoutes} />
        </div>

        {/* Счётчики */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Фрахт</span>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">💵</div>
            </div>
            <div className="text-3xl font-bold text-green-600">{totalRevenue.toFixed(2)} €</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Расходы</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">📉</div>
            </div>
            <div className="text-3xl font-bold text-red-500">{totalExpenses.toFixed(2)} €</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Прибыль</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📈</div>
            </div>
            <div className={`text-3xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {profit.toFixed(2)} €
            </div>
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Статистика по маршрутам</h2>
          </div>
          {sortedRoutes.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <div className="text-6xl mb-4">🛣</div>
              <p>Маршрутов пока нет</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маршрут</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Рейсов</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRoutes.map((r, i) => {
                    const rProfit = r.revenue - r.expenses;
                    return (
                      <tr key={r.route} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-800">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            {r.route}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-green-600">
                          {r.revenue.toFixed(2)} €
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-red-500">
                          {r.expenses.toFixed(2)} €
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${rProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {rProfit.toFixed(2)} €
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold">
                            {r.count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
