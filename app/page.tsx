import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function Home() {
  const { data: trips } = await supabase
    .from('trips')
    .select('revenue_eur, start_date');

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('amount_eur, expense_date');

  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  // Считаем количество рейсов
  const totalTrips = trips?.length || 0;

  // Считаем среднюю прибыль за рейс
  const averageProfitPerTrip = totalTrips > 0 ? profit / totalTrips : 0;

  // Считаем показатели за текущий месяц
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const monthTrips = trips?.filter(t => {
    if (!t.start_date) return false;
    const tripDate = new Date(t.start_date);
    return tripDate >= startOfMonth && tripDate <= endOfMonth;
  }) || [];

  const monthRevenue = monthTrips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;

  const monthExpenses = expenses?.filter(e => {
    if (!e.expense_date) return false;
    const expDate = new Date(e.expense_date);
    return expDate >= startOfMonth && expDate <= endOfMonth;
  }) || [];

  const monthExpensesTotal = monthExpenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;

  const monthProfit = monthRevenue - monthExpensesTotal;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚛 Панель управления</h1>
          <Button asChild>
            <a href="/trips/new">+ Создать рейс</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
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

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Средняя прибыль за рейс</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {averageProfitPerTrip.toFixed(2)} €
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Прибыль за текущий месяц</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {monthProfit.toFixed(2)} €
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Рейсы за текущий месяц</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {monthTrips.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-sm border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Фрахт за текущий месяц</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {monthRevenue.toFixed(2)} €
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-4">
          <Button asChild variant="default">
            <a href="/map">📍 Карта рейсов</a>
          </Button>
          <Button asChild variant="secondary">
            <a href="/driver">🚛 Водитель</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/reminders">⏰ Напоминания</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/drivers">🚛 Водители</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/trucks">🚚 Машины</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/clients">🤝 Клиенты</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/trips">📋 Рейсы</a>
          </Button>
          <Button asChild variant="ghost">
            <a href="/fixed-costs">💰 Фикс. затраты</a>
          </Button>
          <Button asChild variant="ghost">
            <a href="/reports">💰 Отчёт о прибыли</a>
          </Button>
          <Button asChild variant="ghost">
            <a href="/routes">🚛 Маршруты</a>
          </Button>
        </div>

      </div>
    </main>
  );
}
