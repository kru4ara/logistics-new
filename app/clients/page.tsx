import { supabase } from '../../lib/supabaseClient';

export default async function ClientsPage() {
  const { data: clients, error } = await supabase.from('clients').select('*');
  if (error) return <div>Ошибка: {error.message}</div>;

  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h1>Клиенты</h1>
        <a href="/clients/new" style={{ backgroundColor: '#0070f3', color: 'white', padding: '10px 20px', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' }}>+ Добавить</a>
      </div>
      <table style={{ width: '100%', marginTop: '15px', borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
          <th>Название</th><th>Контакт</th><th>Телефон</th><th>Email</th>
        </tr></thead>
        <tbody>
          {clients?.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{c.name}</td><td>{c.contact_person || '-'}</td><td>{c.phone || '-'}</td><td>{c.email || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}