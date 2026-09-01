import { supabase } from '../../../../lib/supabaseClient';
import { updateTrip } from '../../../trip-actions';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  const { data: clients } = await supabase.from('clients').select('id, name');
  const { data: trucks } = await supabase.from('trucks').select('id, registration_number');

  if (error) return <div>Ошибка загрузки: {error.message}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '24px' }}>Редактировать рейс №{trip.trip_number || '—'}</h1>
      <form action={updateTrip.bind(null, tripId)} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label>Клиент</label>
          <select name="client_id" defaultValue={trip.client_id || ''} style={{ width: '100%', padding: '8px' }}>
            <option value="">Выберите клиента...</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label>Машина</label>
          <select name="truck_id" defaultValue={trip.truck_id || ''} style={{ width: '100%', padding: '8px' }}>
            <option value="">Выберите машину...</option>
            {trucks?.map(t => <option key={t.id} value={t.id}>{t.registration_number}</option>)}
          </select>
        </div>
        {/* ДОБАВЛЯЕМ ПОЛЕ ОСТАТКА ТОПЛИВА */}
        <div>
          <label>Остаток топлива на начало (л)</label>
          <input type="number" name="start_fuel_level" step="0.01" defaultValue={trip.start_fuel_level || 0} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Дата старта</label>
          <input type="date" name="start_date" defaultValue={trip.start_date?.split('T')[0] || ''} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Фрахт (€)</label>
          <input type="number" name="revenue_eur" step="0.01" defaultValue={trip.revenue_eur || 0} style={{ width: '100%', padding: '8px' }} />
        </div>

        {/* Заявка клиента */}
        <h3 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>📄 Заявка клиента</h3>
        <div>
          <label>Номер заявки</label>
          <input type="text" name="client_request_number" defaultValue={trip.client_request_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Дата заявки</label>
          <input type="date" name="client_request_date" defaultValue={trip.client_request_date || ''} style={{ width: '100%', padding: '8px' }} />
        </div>

        {/* Отправитель */}
        <h3 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>📍 Отправитель</h3>
        <div>
          <label>Страна</label>
          <input type="text" name="sender_country" defaultValue={trip.sender_country || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Название</label>
          <input type="text" name="sender_name" defaultValue={trip.sender_name || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Почтовый код</label>
          <input type="text" name="sender_postal_code" defaultValue={trip.sender_postal_code || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Город</label>
          <input type="text" name="sender_city" defaultValue={trip.sender_city || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Адрес</label>
          <input type="text" name="sender_address" defaultValue={trip.sender_address || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Погрузочный номер</label>
          <input type="text" name="sender_loading_number" defaultValue={trip.sender_loading_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>

        {/* Получатель */}
        <h3 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>🏁 Получатель</h3>
        <div>
          <label>Страна</label>
          <input type="text" name="receiver_country" defaultValue={trip.receiver_country || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Название</label>
          <input type="text" name="receiver_name" defaultValue={trip.receiver_name || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Почтовый код</label>
          <input type="text" name="receiver_postal_code" defaultValue={trip.receiver_postal_code || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Город</label>
          <input type="text" name="receiver_city" defaultValue={trip.receiver_city || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Адрес</label>
          <input type="text" name="receiver_address" defaultValue={trip.receiver_address || ''} style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Погрузочный номер</label>
          <input type="text" name="receiver_loading_number" defaultValue={trip.receiver_loading_number || ''} style={{ width: '100%', padding: '8px' }} />
        </div>

        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Сохранить изменения</button>
        <a href={`/trips/${tripId}`} style={{ color: '#0070f3' }}>← Назад к рейсу</a>
      </form>
    </div>
  );
}
