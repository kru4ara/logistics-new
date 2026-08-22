import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Формат даты для фильтра "текущий месяц"
function getMonthRange() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  return { start: startOfMonth.toISOString(), end: endOfMonth.toISOString() };
}

export default async function Home() {
  const { start, end } = getMonthRange();

  // Загружаем рейсы за текущий месяц
  const { data: trips } = await supabase
    .from('trips')
    .select('revenue_eur, start_date, status')
    .gte('start_date', start)
    .lte('start_date', end);

  // Загружаем расходы за текущий месяц (через дату расхода)
  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('amount_eur, expense_date')
    .gte('expense_date', start)
    .lte('expense_date', end);

  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  // Статусы для фильтрации
  const completedTrips = trips?.filter(t => t.status === 'completed').length || 0;
  const activeTrips = trips?.filter(t => t.status === 'active').length || 0;
  const paidTrips = trips?.filter(t => t.status === 'paid').length || 0;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Заголовок */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚛 Панель управления</h1>
          <Button asChild>
            <a href="/trips/new">+ Создать рейс</a>
          </Button>
        </div>

        {/* Текущий месяц */}
        <div className="text-sm text-gray-600 mb-2">
          Текущий месяц: {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
        </div>

        {/* Карточки со статистикой */}
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

        {/* Статусы рейсов */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <span className="text-blue-600 font-bold">{completedTrips}</span>
            <span className="text-sm text-gray-600 ml-2">Завершённые</span>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <span className="text-yellow-600 font-bold">{activeTrips}</span>
            <span className="text-sm text-gray-600 ml-2">В пути</span>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <span className="text-green-600 font-bold">{paidTrips}</span>
            <span className="text-sm text-gray-600 ml-2">Оплаченные</span>
          </div>
        </div>

        {/* Быстрый доступ */}
        <div className="flex flex-wrap gap-4">
          <Button asChild variant="default">
            <a href="/drivers">🚛 Водители</a>
          </Button>
          <Button asChild variant="secondary">
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
        </div>

      </div>
    </main>
  );
}
