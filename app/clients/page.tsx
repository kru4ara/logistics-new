import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { deleteClient } from '../delete-actions';

export default async function ClientsPage() {
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*');

  if (error) {
    return <div>Ошибка загрузки: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🤝 Клиенты</h1>
          <Button asChild>
            <a href="/clients/new">+ Добавить клиента</a>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {clients?.map((client) => (
            <div key={client.id} style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p><strong>Название:</strong> {client.name}</p>
              <p><strong>Контактное лицо:</strong> {client.contact_person || '-'}</p>
              <p><strong>Телефон:</strong> {client.phone || '-'}</p>
              <p><strong>Email:</strong> {client.email || '-'}</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <a href={`/clients/${client.id}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                  Профиль
                </a>
                <form action={async () => {
                  'use server';
                  await deleteClient(client.id);
                }}>
                  <button type="submit" style={{ padding: '4px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    🗑️ Удалить
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
