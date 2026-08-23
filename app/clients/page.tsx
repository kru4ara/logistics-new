import { supabase } from '../../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addClient } from '../../client-actions';

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
              <a href={`/clients/${client.id}`} style={{ color: '#0070f3', textDecoration: 'underline' }}>
                Профиль клиента
              </a>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}
