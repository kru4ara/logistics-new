import { supabase } from '../../../lib/supabaseClient';
import { addTripWithAddress } from '../../geocode-actions';

export default async function NewTripPage() {
  const { data: clients } = await supabase.from('clients').select('id, name');
  const { data: trucks } = await supabase.from('trucks').select('id, registration_number');

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '24px' }}>Создать новый рейс</h1>
      <form action={addTripWithAddress} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        {/* Основные данные */}
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
          <label>Дата старта</label>
          <input type="date" name="start_date" required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Фрахт (€)</label>
          <input type="number" name="revenue_eur" step="0.01" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Остаток топлива (л)</label>
          <input type="number" name="start_fuel_level" step="0.01" placeholder="Например, 200" style={{ width: '100%', padding: '8px' }} />
        </div>

        {/* Заявка клиента */}
        <h3 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>📄 Заявка клиента</h3>
        <div>
          <label>Номер заявки</label>
          <input type="text" name="client_request_number" placeholder="Например, ZAM-2026-001" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Дата заявки</label>
          <input type="date" name="client_request_date" style={{ width: '100%', padding: '8px' }} />
        </div>

        {/* Отправитель */}
        <h3 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>📍 Отправитель (загрузка)</h3>
        <div>
          <label>Страна</label>
          <input type="text" name="sender_country" placeholder="Польша" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Название отправителя</label>
          <input type="text" name="sender_name" placeholder="ООО Пример" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Почтовый код</label>
          <input type="text" name="sender_postal_code" placeholder="00-001" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Город</label>
          <input type="text" name="sender_city" placeholder="Варшава" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Адрес</label>
          <input type="text" name="sender_address" placeholder="ул. Примерная, 1" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Погрузочный номер (если есть)</label>
          <input type="text" name="sender_loading_number" placeholder="Ramp 4" style={{ width: '100%', padding: '8px' }} />
        </div>

        {/* Получатель */}
        <h3 style={{ marginTop: '20px', borderBottom: '1px solid #ccc', paddingBottom: '5px' }}>🏁 Получатель (выгрузка)</h3>
        <div>
          <label>Страна</label>
          <input type="text" name="receiver_country" placeholder="Беларусь" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Название получателя</label>
          <input type="text" name="receiver_name" placeholder="ООО Пример" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Почтовый код</label>
          <input type="text" name="receiver_postal_code" placeholder="220000" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Город</label>
          <input type="text" name="receiver_city" placeholder="Брест" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Адрес</label>
          <input type="text" name="receiver_address" placeholder="ул. Советская, 1" style={{ width: '100%', padding: '8px' }} />
        </div>
        <div>
          <label>Погрузочный номер (если есть)</label>
          <input type="text" name="receiver_loading_number" placeholder="Ramp 1" style={{ width: '100%', padding: '8px' }} />
        </div>

        <button type="submit" style={{ padding: '10px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '20px' }}>Создать рейс</button>
        <a href="/trips" style={{ color: '#0070f3' }}>← Назад к списку</a>
      </form>
    </div>
  );
}
