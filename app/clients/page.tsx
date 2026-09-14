import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  // Считаем количество рейсов по каждому клиенту
  const { data: trips } = await supabase
    .from('trips')
    .select('client_id');

  const tripsByClient = trips?.reduce((acc, t) => {
    if (!t.client_id) return acc;
    if (!acc[t.client_id]) acc[t.client_id] = 0;
    acc[t.client_id] += 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">🤝 Клиенты</h1>
            <p className="text-slate-500 mt-1">Всего клиентов: {clients?.length || 0}</p>
          </div>
          <a
            href="/clients/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Добавить клиента</span>
          </a>
        </div>

        {/* Сетка */}
        {clients?.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">🤝</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Клиентов пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первого клиента, чтобы начать работу</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {clients?.map((client) => {
              const initials = client.name
                ?.split(' ')
                .map((w: string) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const tripCount = tripsByClient[client.id] || 0;

              return (
                <a
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                             hover:shadow-xl hover:border-blue-200 hover:-translate-y-0.5
                             transition-all duration-200 overflow-hidden"
                >
                  <div className="p-5">
                    {/* Аватар и название */}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-pink-700
                                      flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {initials || '🤝'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {client.name}
                        </div>
                        <div className="text-sm text-slate-500 truncate">
                          👤 {client.contact_person || 'Контакт не указан'}
                        </div>
                      </div>
                    </div>

                    {/* Контакты */}
                    <div className="space-y-1 text-sm text-slate-600 mb-4">
                      <div className="flex items-center gap-2">
                        <span>📞</span>
                        <span className="truncate">{client.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>✉️</span>
                        <span className="truncate">{client.email || '—'}</span>
                      </div>
                    </div>

                    {/* Количество рейсов */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wide text-slate-400 font-medium">
                        Рейсов
                      </span>
                      <span className="text-lg font-bold text-blue-600">{tripCount}</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
