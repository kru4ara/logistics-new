import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';

async function createTrip(formData: FormData) {
  'use server';

  // Получаем данные из формы
  const clientId = formData.get('client_id') as string;
  const route = formData.get('route') as string;
  const startDate = formData.get('start_date') as string;
  const revenueEur = parseFloat(formData.get('revenue_eur') as string) || 0;

  // Вставляем рейс в таблицу trips
  const { data, error } = await supabase
    .from('trips')
    .insert([
      { 
        client_id: clientId || null,
        route: route,
        start_date: startDate,
        revenue_eur: revenueEur,
        status: 'planned'
      }
    ]);

  if (error) {
    throw new Error(`Ошибка создания рейса: ${error.message} (Код: ${error.code})`);
  }

  redirect('/trips');
}

export default function NewTripPage() {
  // Сначала загружаем список клиентов для выпадающего списка
  // Функция внутри компонента для получения данных
  async function getClients() {
    const { data } = await supabase.from('clients').select('id, name');
    return data || [];
  }

  // Используем Server Component для рендера
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h1 style={{ fontSize: '24px' }}>Создать новый рейс</h1>
      
      <form action={createTrip} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        
        <div>
          <label htmlFor="client_id" style={{ display: 'block', fontWeight: 'bold' }}>Клиент</label>
          <ClientSelect />
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
          <label htmlFor="revenue_eur" style={{ display: 'block', fontWeight: 'bold' }}>Выручка за рейс (€)</label>
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
          ← Назад к списку рейсов
        </a>
      </form>
    </div>
  );
}

// Отдельный компонент для загрузки списка клиентов (Server Component внутри)
async function ClientSelect() {
  const { data: clients } = await supabase.from('clients').select('id, name');
  
  return (
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
  );
}