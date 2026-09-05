import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import DownloadButton from './DownloadButton';

export default async function TripsPage() {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .order('trip_number', { ascending: false });

  if (error) {
    return <div>Ошибка загрузки рейсов: {error.message}</div>;
  }

  // Группируем расходы по рейсам (суммируем amount_eur)
  const { data: expenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  if (expensesError) {
    return <div>Ошибка загрузки расходов: {expensesError.message}</div>;
  }

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">📋 Рейсы</h1>
          <div className="flex gap-4">
            <Button asChild>
              <a href="/trips/new">+ Создать рейс</a>
            </Button>
            <DownloadButton data={trips || []} />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {trips?.map((trip) => {
            const tripExpenses = expensesByTrip[trip.id] || 0;
            const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
            return (
              <div key={trip.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <p><strong>№ рейса:</strong> {trip.trip_number || '—'}</p>
                <p><strong>Клиент:</strong> {trip.clients?.name || 'Не указан'}</p>
                <p><strong>Маршрут:</strong> {trip.route || '-'}</p>
                <p><strong>Статус:</strong> {trip.status}</p>
                <p><strong>Фрахт:</strong> {trip.revenue_eur ? `${trip.revenue_eur} €` : '-'}</p>
                <p><strong>Расходы:</strong> {tripExpenses.toFixed(2)} €</p>
                <p><strong>Прибыль:</strong> {tripProfit.toFixed(2)} €</p>
                <a href={`/trips/${trip.id}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                  Профиль рейса
                </a>
              </div>
            );
          })}
        </div>

      </div>
    </main>
  );
}
