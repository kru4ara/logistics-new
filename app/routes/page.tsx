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
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">🛣 Маршруты</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Всего маршрутов: {sortedRoutes.length}</p>
          </div>
          <DownloadButton data={sortedRoutes} />
        </div>

        {/* Счётчики */}
        <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Фрахт</span>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-50 flex items-center justify-center text-base md:text-xl">💵</div>
            </div>
            <div className="text-xl md:text-3xl font-bold text-green-600 break-words">{totalRevenue.toFixed(2)} €</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Расходы</span>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-50 flex items-center justify-center text-base md:text-xl">📉</div>
            </div>
            <div className="text-xl md:text-3xl font-bold text-red-500 break-words">{totalExpenses.toFixed(2)} €</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Прибыль</span>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-50 flex items-center justify-center text-base md:text-xl">📈</div>
            </div>
            <div className={`text-xl md:text-3xl font-bold break-words ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {profit.toFixed(2)} €
            </div>
          </div>
        </div>

        {/* Таблица / карточки */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100">
            <h2 className="text-base md:text-lg font-bold text-slate-900">Статистика по маршрутам</h2>
          </div>

          {sortedRoutes.length === 0 ? (
            <div className="p-10 md:p-16 text-center text-slate-400">
              <div className="text-5xl md:text-6xl mb-4">🛣</div>
              <p>Маршрутов пока нет</p>
            </div>
          ) : (
            <>
              {/* Mobile: карточки */}
              <div className="md:hidden divide-y divide-slate-100">
                {sortedRoutes.map((r, i) => {
                  const rProfit = r.revenue - r.expenses;
                  return (
                    <div key={r.route} className="p-4 space-y-3">
                      {/* Заголовок карточки */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 break-words">{r.route}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Рейсов: <b className="text-slate-600">{r.count}</b>
                          </div>
                        </div>
                      </div>

                      {/* Экономика */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Фрахт</div>
                          <div className="text-sm font-bold text-green-600 break-words">
                            {r.revenue.toFixed(0)} €
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Расходы</div>
                          <div className="text-sm font-bold text-red-500 break-words">
                            {r.expenses.toFixed(0)} €
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Прибыль</div>
                          <div className={`text-sm font-bold break-words ${rProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {rProfit.toFixed(0)} €
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: таблица */}
              <div className="hidden md:block overflow-x-auto">
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
                          <td className="px-6 py-4 text-right font-semibold text-green-600 whitespace-nowrap">
                            {r.revenue.toFixed(2)} €
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-red-500 whitespace-nowrap">
                            {r.expenses.toFixed(2)} €
                          </td>
                          <td className={`px-6 py-4 text-right font-bold whitespace-nowrap ${rProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
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
            </>
          )}
        </div>

      </div>
    </main>
  );
}
