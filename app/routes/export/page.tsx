import { supabase } from '../../../lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default async function ExportPage() {
  const { data: trips } = await supabase
    .from('trips')
    .select('route, revenue_eur, id');

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  // Группируем расходы по маршруту
  const routes = trips?.reduce((acc, trip) => {
    if (!trip.route) return acc;
    const existing = acc.find(r => r.route === trip.route);
    if (existing) {
      existing.revenue += trip.revenue_eur || 0;
    } else {
      acc.push({ route: trip.route, revenue: trip.revenue_eur || 0, expenses: 0 });
    }
    return acc;
  }, [] as Array<{ route: string; revenue: number; expenses: number }>) || [];

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    const existing = acc.find(item => item.trip_id === e.trip_id);
    if (existing) {
      existing.amount += e.amount_eur || 0;
    } else {
      acc.push({ trip_id: e.trip_id, amount: e.amount_eur || 0 });
    }
    return acc;
  }, [] as Array<{ trip_id: string; amount: number }>) || [];

  const routesWithExpenses = routes.map((route) => {
    const tripIds = trips?.filter(t => t.route === route.route).map(t => t.id) || [];
    const routeExpenses = expensesByTrip.filter(e => tripIds.includes(e.trip_id)).reduce((sum, e) => sum + e.amount, 0);
    return {
      ...route,
      expenses: routeExpenses
    };
  });

  const totalRevenue = routesWithExpenses?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0;
  const totalExpenses = routesWithExpenses?.reduce((sum, r) => sum + (r.expenses || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">📥 Отчёт для бухгалтер</h1>
          <Button asChild>
            <a href="/routes">← Назад</a>
          </Button>
        </div>

        <table style={{ width: '100%', marginTop: '30px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px' }}>Маршрут</th>
              <th style={{ padding: '10px' }}>Выручка (€)</th>
              <th style={{ padding: '10px' }}>Расходы (€)</th>
              <th style={{ padding: '10px' }}>Прибыль (€)</th>
            </tr>
          </thead>
          <tbody>
            {routesWithExpenses?.map((r) => (
              <tr key={r.route} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{r.route}</td>
                <td style={{ padding: '10px' }}>{r.revenue.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>{r.expenses.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ color: (r.revenue - r.expenses) >= 0 ? 'green' : 'red', fontWeight: 'bold' }}>
                    {(r.revenue - r.expenses).toFixed(2)} €
                  </span>
                </td>
              </tr>
            ))}
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>Общая итог</td>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>{totalRevenue.toFixed(2)} €</td>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>{totalExpenses.toFixed(2)} €</td>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>{profit.toFixed(2)} €</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '20px' }}>
          <Button asChild>
            <a href="/routes">← Назад</a>
          </Button>
        </div>
      </div>
    </main>
  );
}
