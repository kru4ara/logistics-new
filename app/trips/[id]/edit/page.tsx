import { supabase } from '../../../../lib/supabaseClient';
import { updateTrip } from '../../../trip-actions';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('id', tripId)
    .single();

  const { data: clients } = await supabase.from('clients').select('id, name');

  if (error) return <div>Ошибка загрузки: {error.message}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Редактировать рейс</h1>
      <form action={updateTrip.bind(null, tripId)} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label>Клиент</label>
          <select name="client_id" defaultValue={trip.client_id || ''} style={{ width: '100%', padding: '8px' }}>
            <option value="">Выберите клиента...</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label>Маршрут</label>
          <input type="text" name="route" defaultValue={trip.route || ''} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Дата старта</label>
          <input type="date" name="start_date" defaultValue={trip.start_date?.split('T')[0] || ''} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Фрахт (€)</label>
          <input type="number" name="revenue_eur" step="0.01" defaultValue={trip.revenue_eur || 0} style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Сохранить изменения</button>
        <a href={`/trips/${tripId}`} style={{ color: '#0070f3' }}>← Назад к рейсу</a>
      </form>
    </div>
  );
}
