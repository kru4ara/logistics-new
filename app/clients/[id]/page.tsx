import { supabase } from '../../../lib/supabaseClient';

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  
  if (!clientId) {
    return <div>Ошибка: ID клиента не передан</div>;
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*')
    .eq('client_id', clientId);

  if (clientError || tripsError) {
    return <div>Ошибка загрузки: {clientError?.message || tripsError?.message}</div>;
  }

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px' }}>Профиль клиента</h1>
        <a href="/clients" style={{ color: '#0070f3' }}>← Все клиенты</a>
      </div>

      <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
        <p><strong>Название:</strong> {client.name}</p>
        <p><strong>Контактное лицо:</strong> {client.contact_person || '-'}</p>
        <p><strong>Телефон:</strong> {client.phone || '-'}</p>
        <p><strong>Email:</strong> {client.email || '-'}</p>
      </div>

      <div style={{ marginTop: '25px' }}>
        <h2>Рейсы этого клиента</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>Маршрут</th>
              <th style={{ padding: '10px' }}>Статус</th>
              <th style={{ padding: '10px' }}>Выручка (€)</th>
            </tr>
          </thead>
          <tbody>
            {trips?.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Пока нет рейсов</td></tr>
            ) : (
              trips?.map((trip) => (
                <tr key={trip.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{trip.route || '-'}</td>
                  <td style={{ padding: '10px' }}>{trip.status}</td>
                  <td style={{ padding: '10px' }}>{trip.revenue_eur ? `${trip.revenue_eur} €` : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '25px' }}>
        <a href="/clients/new" style={{ color: '#0070f3', textDecoration: 'underline' }}>
          ← Добавить клиента
        </a>
      </div>
    </main>
  );
}
