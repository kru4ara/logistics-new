import { supabase } from '../../../lib/supabaseClient';
import { addTripWithAddress } from '../../geocode-actions';

export default async function NewTripPage() {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name');

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Создать новый рейс</h1>
      
      <form action={addTripWithAddress} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label htmlFor="client_id" style={{ display: 'block', fontWeight: 'bold' }}>Клиент</label>
          <select 
            id="client_id" 
            name="client_id" 
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            <option value="">Выберите клиента...</option>
            {clients?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="route" style={{ display: 'block', fontWeight: 'bold' }}>Маршрут</label>
          <input 
            type="text" 
            id="route" 
            name="route" 
            placeholder="Например: Варшава → Брест ТЛЦ"
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="loading_address" style={{ display: 'block', fontWeight: 'bold' }}>Адрес погрузки</label>
          <input 
            type="text" 
            id="loading_address" 
            name="loading_address" 
            placeholder="Например: ul. Transportowa 1, Warszawa"
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="warehouse_name" style={{ display: 'block', fontWeight: 'bold' }}>Название склада</label>
          <input 
            type="text" 
            id="warehouse_name" 
            name="warehouse_name" 
            placeholder="Например: Logisat Warehouse"
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="start_date" style={{ display: 'block', fontWeight: 'bold' }}>Дата старта</label>
          <input 
            type="date" 
            id="start_date" 
            name="start_date" 
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="revenue_eur" style={{ display: 'block', fontWeight: 'bold' }}>Фрахт (€)</label>
          <input 
            type="number" 
            id="revenue_eur" 
            name="revenue_eur" 
            step="0.01"
            placeholder="0.00"
            style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button 
          type="submit" 
          style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#0070f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Создать рейс
        </button>

        <a href="/trips" style={{ marginTop: '10px', color: '#0070f3', textDecoration: 'underline' }}>
          ← Назад к списку
        </a>
      </form>
    </div>
  );
}
