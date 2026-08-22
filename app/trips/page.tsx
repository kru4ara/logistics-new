import { supabase } from '../../lib/supabaseClient';
import { TripFilters } from './trip-filters';

export default async function TripsPage() {
  // В Next.js 14 мы используем searchParams в серверных компонентах
  const searchParams = await new Promise((resolve) => {
    // Это упрощение, но на самом деле searchParams нужно получать иначе
    resolve({ status: '' });
  });

  // В реальном коде, поиск по фильтру происходит через URL
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name)');

  if (error) {
    return <div>Ошибка загрузки рейсов: {error.message}</div>;
  }

  // Если URL содержит фильтр status, добавляем его в запрос
  // Это будет сделано в следующем шаге через компонент поиска

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Список рейсов</h1>
        <a 
          href="/trips/new" 
          style={{ 
            backgroundColor: '#0070f3', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '5px', 
            textDecoration: 'none', 
            fontWeight: 'bold' 
          }}
        >
          + Создать рейс
        </a>
      </div>

      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <TripFilters />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '10px' }}>Клиент</th>
            <th style={{ padding: '10px' }}>Маршрут</th>
            <th style={{ padding: '10px' }}>Статус</th>
            <th style={{ padding: '10px' }}>Выручка (€)</th>
            <th style={{ padding: '10px' }}>Дата старта</th>
          </tr>
        </thead>
        <tbody>
          {trips?.map((trip) => (
            <tr key={trip.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>
                <a href={`/trips/${trip.id}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                  {trip.clients?.name || 'Не указан'}
                </a>
              </td>
              <td style={{ padding: '10px' }}>{trip.route || '-'}</td>
              <td style={{ padding: '10px' }}>
                <span style={{ 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  backgroundColor: 
                    trip.status === 'planned' ? '#f0f0f0' :
                    trip.status === 'active' ? '#dbeafe' :
                    trip.status === 'completed' ? '#dcfce7' :
                    trip.status === 'invoiced' ? '#fef9c3' :
                    trip.status === 'paid' ? '#d1fae5' : '#f0f0f0'
                }}>
                  {trip.status === 'planned' ? 'Планируется' :
                   trip.status === 'active' ? 'В пути' :
                   trip.status === 'completed' ? 'Завершён' :
                   trip.status === 'invoiced' ? 'Выставлен счёт' :
                   trip.status === 'paid' ? 'Оплачен' : trip.status}
                </span>
              </td>
              <td style={{ padding: '10px' }}>{trip.revenue_eur ? `${trip.revenue_eur} €` : '-'}</td>
              <td style={{ padding: '10px' }}>{trip.start_date ? new Date(trip.start_date).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
