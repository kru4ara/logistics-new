import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function DriverPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;

  if (role !== 'driver' || !driverId) {
    redirect('/login');
  }

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('driver_id', driverId)
    .order('trip_number', { ascending: false });

  if (error) {
    return <div>Ошибка загрузки рейсов: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚚 Мои рейсы</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {trips?.length === 0 ? (
            <p style={{ color: '#888' }}>У вас пока нет назначенных рейсов</p>
          ) : (
            trips?.map((trip) => (
              <div key={trip.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <p><strong>№ рейса:</strong> {trip.trip_number || '—'}</p>
                <p><strong>Клиент:</strong> {trip.clients?.name || 'Не указан'}</p>
                <p><strong>Маршрут:</strong> {trip.route || '-'}</p>
                <p><strong>Статус:</strong> {trip.status}</p>
                <p><strong>Дата старта:</strong> {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '-'}</p>
                <a href={`/driver/trips/${trip.id}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                  Открыть рейс
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
