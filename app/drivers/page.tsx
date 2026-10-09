import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import {
  UserCircle,
  UserPlus,
  BarChart3,
  Phone,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('*')
    .order('last_name', { ascending: true });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  // Считаем количество рейсов у каждого водителя
  const { data: allTrips } = await supabase
    .from('trips')
    .select('driver_id');

  const tripsCountByDriver: Record<string, number> = {};
  allTrips?.forEach((t) => {
    if (!t.driver_id) return;
    tripsCountByDriver[t.driver_id] = (tripsCountByDriver[t.driver_id] || 0) + 1;
  });

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function getMinDays(driver: any) {
    const dates = [
      driver.passport_expiry,
      driver.visa_expiry,
      driver.license_expiry,
      driver.tachograph_card_expiry,
      driver.code_95_expiry,
      driver.adr_expiry,
    ].filter(Boolean);
    if (dates.length === 0) return null;
    const days = dates.map((d) => getDaysUntil(d)).filter((d) => d !== null) as number[];
    return Math.min(...days);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <UserCircle className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Водители
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Всего водителей: <b className="text-slate-700">{drivers?.length || 0}</b>
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
            <a href="/drivers/kpi" className="btn btn-secondary text-sm md:text-base justify-center">
              <BarChart3 className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2} />
              KPI водителей
            </a>
            <a href="/drivers/new" className="btn btn-primary text-sm md:text-base justify-center">
              <UserPlus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
              Добавить водителя
            </a>
          </div>
        </div>

        {/* Сетка */}
        {drivers?.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Водителей пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первого водителя, чтобы начать работу</p>
            <a href="/drivers/new" className="btn btn-primary inline-flex">
              <UserPlus className="w-4 h-4" strokeWidth={2.5} />
              Добавить водителя
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {drivers?.map((driver) => {
              const minDays = getMinDays(driver);
              const isExpired = minDays !== null && minDays < 0;
              const isSoon = minDays !== null && minDays >= 0 && minDays < 30;

              const statusColor =
                minDays === null ? 'bg-slate-50 text-slate-600 border-slate-200' :
                isExpired ? 'bg-red-50 text-red-700 border-red-200' :
                isSoon ? 'bg-orange-50 text-orange-700 border-orange-200' :
                'bg-green-50 text-green-700 border-green-200';

              const StatusIcon =
                minDays === null ? Clock :
                isExpired ? AlertTriangle :
                isSoon ? Clock :
                CheckCircle2;

              const statusLabel =
                minDays === null ? 'Нет данных' :
                isExpired ? `Просрочено (${Math.abs(minDays)} дн.)` :
                isSoon ? `${minDays} дн. до срока` :
                `OK (${minDays} дн.)`;

              const initials = `${driver.first_name?.[0] || ''}${driver.last_name?.[0] || ''}`.toUpperCase();
              const tripsCount = tripsCountByDriver[driver.id] || 0;

              return (
                <a
                  key={driver.id}
                  href={`/drivers/${driver.id}`}
                  className="group card card-hover overflow-hidden"
                >
                  <div className="p-4 md:p-5">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-accent-500
                                      flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-brand">
                        {initials || <UserIcon className="w-6 h-6" strokeWidth={2} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors truncate">
                          {driver.first_name} {driver.last_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-slate-500 truncate">
                          <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                          <span className="truncate">{driver.phone || 'Телефон не указан'}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${statusColor}`}>
                      <StatusIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
                      <span>{statusLabel}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Виза</div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 tabular-nums">
                          {driver.visa_expiry ? new Date(driver.visa_expiry).toLocaleDateString('ru-RU') : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Права</div>
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 tabular-nums">
                          {driver.license_expiry ? new Date(driver.license_expiry).toLocaleDateString('ru-RU') : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Рейсов</div>
                        <div className={`text-xs sm:text-sm font-bold tabular-nums ${tripsCount > 0 ? 'text-brand-600' : 'text-slate-400'}`}>
                          {tripsCount > 0 ? tripsCount : '—'}
                        </div>
                      </div>
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
