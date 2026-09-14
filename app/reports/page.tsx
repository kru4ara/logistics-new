import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import DownloadButton from './DownloadButton';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .order('trip_number', { ascending: false });

  if (tripsError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {tripsError.message}</div>;
  }

  const { data: expenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  if (expensesError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {expensesError.message}</div>;
  }

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  const tripsWithExpenses = trips?.map((trip) => ({
    ...trip,
    expenses: expensesByTrip[trip.id] || 0
  })) || [];

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700',
    active: 'bg-blue-50 text-blue-700',
    completed: 'bg-green-50 text-green-700',
    invoiced: 'bg-yellow-50 text-yellow-700',
    paid: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">💰 Отчёт о прибыли</h1>
            <p className="text-slate-500 mt-1">Полная финансовая сводка по всем рейсам</p>
          </div>
          <DownloadButton data={tripsWithExpenses} />
        </div>

        {/* Счётчики */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Общий фрахт</span>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">💵</div>
            </div>
            <div className="text-3xl font-bold text-green-600">{totalRevenue.toFixed(2)} €</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Общие расходы</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">📉</div>
            </div>
            <div className="text-3xl font-bold text-red-500">{totalExpenses.toFixed(2)} €</div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Чистая прибыль</span>
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
            <h2 className="text-lg font-bold text-slate-900">Детализация по рейсам</h2>
          </div>
          {tripsWithExpenses.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <div className="text-6xl mb-4">💰</div>
              <p>Рейсов пока нет</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">№</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Клиент</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маршрут</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                  </tr>
                </thead>
                <tbody>
                  {tripsWithExpenses.map((trip) => {
                    const tripProfit = (trip.revenue_eur || 0) - trip.expenses;
                    return (
                      <tr key={trip.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                          {trip.trip_number || '—'}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">
                          <a href={`/trips/${trip.id}`} className="hover:text-blue-600 transition-colors">
                            {trip.clients?.name || 'Не указан'}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {trip.route || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[trip.status] || 'bg-slate-100 text-slate-700'}`}>
                            {statusLabels[trip.status] || trip.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-green-600">
                          {(trip.revenue_eur || 0).toFixed(2)} €
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-red-500">
                          {trip.expenses.toFixed(2)} €
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tripProfit.toFixed(2)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={4} className="px-6 py-4 font-bold text-slate-900">
                      ИТОГО
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-600">
                      {totalRevenue.toFixed(2)} €
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-500">
                      {totalExpenses.toFixed(2)} €
                    </td>
                    <td className={`px-6 py-4 text-right font-bold text-lg ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {profit.toFixed(2)} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
