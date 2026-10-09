import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { deleteClient } from '../client-actions';
import {
  Users,
  Plus,
  User as UserIcon,
  Phone,
  Mail,
  Truck,
  ArrowRight,
  Pencil,
  Trash2,
  Inbox,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClientsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

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
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Users className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Клиенты
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Всего клиентов: <b className="text-slate-700">{clients?.length || 0}</b>
            </p>
          </div>
          <a
            href="/clients/new"
            className="btn btn-primary text-sm md:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            Добавить клиента
          </a>
        </div>

        {clients?.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Клиентов пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первого клиента</p>
            <a href="/clients/new" className="btn btn-primary inline-flex">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Добавить клиента
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {clients?.map((client) => {
              const initials = client.name
                ?.split(' ')
                .map((w: string) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const tripCount = tripsByClient[client.id] || 0;

              return (
                <div
                  key={client.id}
                  className="group card card-hover overflow-hidden flex flex-col"
                >
                  {/* Кликабельная часть */}
                  <a
                    href={`/clients/${client.id}`}
                    className="block flex-1 cursor-pointer"
                    aria-label={`Открыть карточку ${client.name}`}
                  >
                    <div className="p-5">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500
                                        flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-brand">
                          {initials || <Users className="w-6 h-6" strokeWidth={2.2} />}
                        </div>
                        <div className="min-w-0 flex-1 pr-5">
                          <div className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                            {client.name}
                          </div>
                          {client.contact_person && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 truncate">
                              <UserIcon className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                              <span className="truncate">{client.contact_person}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 text-sm text-slate-600 mb-4">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                          <span className="truncate tabular-nums">{client.phone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                          <span className="truncate text-xs">{client.email || '—'}</span>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400 font-medium">
                          <Truck className="w-3.5 h-3.5" strokeWidth={2} />
                          Рейсов: <b className={`tabular-nums ${tripCount > 0 ? 'text-brand-600' : 'text-slate-400'}`}>{tripCount}</b>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500
                                                group-hover:translate-x-0.5 transition-all" strokeWidth={2.5} />
                      </div>
                    </div>
                  </a>

                  {/* Кнопки */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/40 flex gap-2">
                    <a
                      href={`/clients/${client.id}/edit`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                                 hover:bg-white transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                      Изменить
                    </a>
                    <form action={async () => {
                      'use server';
                      await deleteClient(client.id);
                    }} className="flex-1">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                   text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        Удалить
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
