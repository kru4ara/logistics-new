import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function Home() {
  // Просто запрашиваем данные, ничего лишнего
  const { data: trips, error: tripError } = await supabase
    .from('trips')
    .select('revenue_eur');

  const { data: expenses, error: expError } = await supabase
    .from('trip_expenses')
    .select('amount_eur');

  // Если ошибка — выводим её на экран, чтобы точно понять причину
  if (tripError || expError) {
    return <div style={{ padding: '20px', color: 'red' }}>
      <h1>Ошибка загрузки данных!</h1>
      <p>Trips: {tripError?.message || 'Нет ошибки'}</p>
      <p>Expenses: {expError?.message || 'Нет ошибки'}</p>
    </div>;
  }

  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚛 Панель управления</h1>
        
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Фрахт</CardTitle>
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

        <div className="flex flex-wrap gap-4">
          <Button asChild variant="default">
            <a href="/trips">📋 Рейсы</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/drivers">🚛 Водители</a>
          </Button>
        </div>
      </div>
    </main>
  );
}
