import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '../../lib/supabaseClient';

export default async function RoutesPage() {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('route, revenue_eur');

  if (error) {
    return <div>Ошибка загрузки рейсов: {error.message}</div>;
  }

  // Список маршрутов по выручке
  const routes = trips?.reduce((acc, trip) => {
    if (!trip.route) return acc;
    const existing = acc.find(r => r.route === trip.route);
    if (existing) {
      existing.revenue += trip.revenue_eur || 0;
    } else {
      acc.push({ route: trip.route, revenue: trip.revenue_eur || 0 });
    }
    return acc;
  }, [] as Array<{ route: string; revenue: number }>) || [];

  // Общая выручка
  const totalRevenue = routes?.reduce((sum, r) => sum + (r.revenue || 0), 0) || 0;

  // Общая расходы
  const totalExpenses = 0;

  // Чистая прибыль
  const profit = totalRevenue - totalExpenses;

  // Сортировка по выручке (высокая → низкая)
  const sortedRoutes = routes.sort((a, b) => a.revenue - b.revenue);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚛 Маршруты</h1>
          <Button asChild>
            <a href="/trips/new">+ Создать рейс</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Выручка</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalRevenue.toFixed(2)} €
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Расходы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {totalExpenses.toFixed(2)} €
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Чистая прибыль</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {profit.toFixed(2)} €
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Выручка по маршрутам</h2>
          <table style={{ width: '100%', marginTop: '15px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px' }}>Маршрут</th>
                <th style={{ padding: '10px' }}>Выручка (€)</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoutes?.map((r) => (
                <tr key={r.route} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{r.route}</td>
                  <td style={{ padding: '10px' }}>{r.revenue.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
