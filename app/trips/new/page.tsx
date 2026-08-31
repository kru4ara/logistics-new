import { supabase } from '../../../lib/supabaseClient';
import { addTripWithAddress } from '../../geocode-actions';

export default async function NewTripPage() {
  const { data: clients } = await supabase.from('clients').select('id, name');
  const { data: trucks } = await supabase.from('trucks').select('id, registration_number');

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Создать новый рейс</h1>
      <form action={addTripWithAddress} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label>Клиент</label>
          <select name="client_id" style={{ width: '100%', padding: '8px' }}>
            <option value="">Выберите клиента...</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label>Машина</label>
          <select name="truck_id" style={{ width: '100%', padding: '8px' }}>
            <option value="">Выберите машину...</option>
            {trucks?.map(t => <option key={t.id} value={t.id}>{t.registration_number}</option>)}
          </select>
        </div>
        <div>
          <label>Маршрут</label>
          <input type="text" name="route" required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Дата старта</label>
          <input type="date" name="start_date" required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Фрахт (€)</label>
          <input type="number" name="revenue_eur" step="0.01" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Остаток топлива (л) — если первый рейс</label>
          <input type="number" name="start_fuel_level" step="0.01" placeholder="Например, 200" style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Создать рейс</button>
        <a href="/trips" style={{ color: '#0070f3' }}>← Назад к списку</a>
      </form>
    </div>
  );
}
