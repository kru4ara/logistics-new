import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default async function ReportsPage() {
  // Получаем все рейсы с клиентами
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*, clients(name)');

  // Получаем все расходы по рейсам
  const { data: expenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('*');

  if (tripsError || expensesError) {
    return <div>Ошибка загрузки: {tripsError?.message || expensesError?.message}</div>;
  }

  // Группируем расходы по рейсам
  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  // Считаем общие показатели
  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  // Функция для скачивания в Excel
  function downloadExcel() {
    // Создаем данные для Excel
    const rows = trips?.map(trip => {
      const tripExpenses = expensesByTrip[trip.id] || 0;
      const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
      return {
        'Клиент': trip.clients?.name || 'Не указан',
        'Маршрут': trip.route || '',
        'Статус': trip.status,
        'Фрахт (€)': trip.revenue_eur || 0,
        'Расходы (€)': tripExpenses,
        'Прибыль (€)': tripProfit
      };
    }) || [];

    // Добавляем итоговую строку
    rows.push({
      'Клиент': 'ИТОГО',
      'Маршрут': '',
      'Статус': '',
      'Фрахт (€)': totalRevenue,
      'Расходы (€)': totalExpenses,
      'Прибыль (€)': profit
    });

    // Преобразуем в CSV (для Excel)
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => row[h] ?? '').join(','))
    ].join('\n');

    // Создаем ссылку на скачивание
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'report.csv';
    link.click();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">💰 Отчёт о прибыли</h1>
          <div className="flex gap-4">
            <Button asChild variant="outline">
              <a href="/routes">← Маршруты</a>
            </Button>
            <Button onClick={downloadExcel} variant="default">
              📥 Скачать Excel
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-500">Фрахт</p>
            <p className="text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} €</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-500">Расходы</p>
            <p className="text-2xl font-bold text-red-500">{totalExpenses.toFixed(2)} €</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <p className="text-sm text-gray-500">Прибыль</p>
            <p className="text-2xl font-bold text-green-600">{profit.toFixed(2)} €</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-500">Клиент</th>
                <th className="text-left p-4 font-medium text-gray-500">Маршрут</th>
                <th className="text-left p-4 font-medium text-gray-500">Статус</th>
                <th className="text-right p-4 font-medium text-gray-500">Фрахт (€)</th>
                <th className="text-right p-4 font-medium text-gray-500">Расходы (€)</th>
                <th className="text-right p-4 font-medium text-gray-500">Прибыль (€)</th>
              </tr>
            </thead>
            <tbody>
              {trips?.map((trip) => {
                const tripExpenses = expensesByTrip[trip.id] || 0;
                const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
                return (
                  <tr key={trip.id} className="border-t border-gray-100">
                    <td className="p-4">{trip.clients?.name || 'Не указан'}</td>
                    <td className="p-4">{trip.route || '-'}</td>
                    <td className="p-4">{trip.status}</td>
                    <td className="p-4 text-right">{trip.revenue_eur || 0} €</td>
                    <td className="p-4 text-right">{tripExpenses.toFixed(2)} €</td>
                    <td className={`p-4 text-right font-bold ${tripProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tripProfit.toFixed(2)} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td className="p-4 font-bold" colSpan={3}>ИТОГО</td>
                <td className="p-4 text-right font-bold">{totalRevenue.toFixed(2)} €</td>
                <td className="p-4 text-right font-bold">{totalExpenses.toFixed(2)} €</td>
                <td className="p-4 text-right font-bold text-green-600">{profit.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </main>
  );
}
