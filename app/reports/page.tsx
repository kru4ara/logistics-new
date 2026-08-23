import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ReportsPage() {
  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*');

  if (tripsError) {
    return <div>Ошибка загрузки рейсов: {tripsError.message}</div>;
  }

  const { data: expenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('*');

  if (expensesError) {
    return <div>Ошибка загрузки расходов: {expensesError.message}</div>;
  }

  // Считаем суммарные показатели
  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  // Суммарные показатели по категориям
  const fuelTotal = expenses?.filter(e => e.category === 'fuel').reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const epiTotal = expenses?.filter(e => e.category === 'epi').reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const etollTotal = expenses?.filter(e => e.category === 'etoll').reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const borderTotal = expenses?.filter(e => e.category === 'border').reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const salaryTotal = expenses?.filter(e => e.category === 'salary').reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const contractorTotal = expenses?.filter(e => e.category === 'contractor').reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const otherTotal = expenses?.filter(e => e.category === 'other').reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">💰 Отчёт о прибыли</h1>
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

        <div style={{ marginTop: '30px', background: 'white', padding: '20px', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Полная таблица затрат</h2>
          <table style={{ width: '100%', marginTop: '15px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px' }}>Категория</th>
                <th style={{ padding: '10px' }}>Сумма (€)</th>
                <th style={{ padding: '10px' }}>Расходы</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>⛽ Топливо</td>
                <td style={{ padding: '10px' }}>{fuelTotal.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>Прямая затрата</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>📄 EPI</td>
                <td style={{ padding: '10px' }}>{epiTotal.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>Прямая затрата</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>🛣 e-TOLL</td>
                <td style={{ padding: '10px' }}>{etollTotal.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>Прямая затрата</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>🛂 Граница</td>
                <td style={{ padding: '10px' }}>{borderTotal.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>Прямая затрата</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>💶 ЗП водителя</td>
                <td style={{ padding: '10px' }}>{salaryTotal.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>Прямая затрата</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>🚛 Подрядчик</td>
                <td style={{ padding: '10px' }}>{contractorTotal.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>Прямая затрата</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>Другое</td>
                <td style={{ padding: '10px' }}>{otherTotal.toFixed(2)} €</td>
                <td style={{ padding: '10px' }}>Прямая затрата</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-4">
          <Button asChild variant="default">
            <a href="/trips">📋 Рейсы</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/reminders">⏰ Напоминания</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/drivers">🚛 Водители</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/trucks">🚚 Машины</a>
          </Button>
          <Button asChild variant="ghost">
            <a href="/fixed-costs">💰 Фикс. затраты</a>
          </Button>
        </div>

      </div>
    </main>
  );
}
