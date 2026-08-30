import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function TripsPage() {
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name)');

  if (error) {
    return <div>Ошибка загрузки рейсов: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">📋 Рейсы</h1>
          <Button asChild>
            <a href="/trips/new">+ Создать рейс</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {trips?.map((trip) => (
            <div key={trip.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p><strong>Клиент:</strong> {trip.clients?.name || 'Не указан'}</p>
              <p><strong>Маршрут:</strong> {trip.route || '-'}</p>
              <p><strong>Статус:</strong> {trip.status}</p>
              <p><strong>Выручка:</strong> {trip.revenue_eur ? `${trip.revenue_eur} €` : 'Не указана'}</p>
              <a href={`/trips/${trip.id}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                Профиль рейса
              </a>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
