import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { can } from '../../lib/roles';
import { getSessionContext } from '../../lib/session';
import {
  Briefcase,
  UserPlus,
  Phone,
  Mail,
  MessageCircle,
  Package,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { fetchAll } from '../../lib/fetch-all';

export const dynamic = 'force-dynamic';

export default async function ManagersPage() {
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');
  if (!can(role, 'managers.view')) redirect('/');

  const supabase = await createClient();

  const { data: managers, error } = await supabase
    .from('managers')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  // Сколько заказов у каждого менеджера (всего и неназначенных).
  const { data: allTrips } = await fetchAll(supabase
    .from('trips')
    .select('manager_id'));

  const tripsCountByManager: Record<string, number> = {};
  let unassignedCount = 0;
  allTrips?.forEach((t) => {
    if (!t.manager_id) {
      unassignedCount += 1;
      return;
    }
    tripsCountByManager[t.manager_id] = (tripsCountByManager[t.manager_id] || 0) + 1;
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Briefcase className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Менеджеры
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Всего менеджеров: <b className="text-slate-700">{managers?.length || 0}</b>
              {unassignedCount > 0 && (
                <> · без назначенного менеджера: <b className="text-slate-700">{unassignedCount}</b></>
              )}
            </p>
          </div>
          <Link href="/managers/new" className="btn btn-primary text-sm md:text-base justify-center">
            <UserPlus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            Добавить менеджера
          </Link>
        </div>

        {managers?.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Менеджеров пока нет</h2>
            <p className="text-slate-500 mb-6">
              Добавьте первого менеджера, чтобы назначать на него заказы
            </p>
            <Link href="/managers/new" className="btn btn-primary inline-flex">
              <UserPlus className="w-4 h-4" strokeWidth={2.5} />
              Добавить менеджера
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {managers?.map((manager) => {
              const tripsCount = tripsCountByManager[manager.id] || 0;
              const isActive = manager.active !== false;

              return (
                <Link
                  key={manager.id}
                  href={`/managers/${manager.id}`}
                  className="card p-5 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                        <Briefcase className="w-5 h-5 text-brand-600" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{manager.full_name}</div>
                        <div className="text-xs text-slate-500">
                          {isActive ? 'Активен' : 'Отключён'}
                        </div>
                      </div>
                    </div>
                    {isActive ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" strokeWidth={2} />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-300 shrink-0" strokeWidth={2} />
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm text-slate-600">
                    {manager.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                        <span className="truncate">{manager.phone}</span>
                      </div>
                    )}
                    {manager.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                        <span className="truncate">{manager.email}</span>
                      </div>
                    )}
                    {manager.telegram_chat_id && (
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                        <span className="truncate">Telegram: {manager.telegram_chat_id}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-600">
                    <Package className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                    Заказов: <b className="text-slate-800">{tripsCount}</b>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
