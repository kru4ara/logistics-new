import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import {
  FlaskConical,
  Package,
  FileText,
  Route as RouteIcon,
  Calendar,
  UserCircle,
  Inbox,
  AlertTriangle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

type DriverRel = { first_name: string | null; last_name: string | null };

export default async function TripsTestPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; status?: string };
}) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();

  const now = new Date();
  const currentYear = now.getFullYear();

  const year = parseInt(searchParams?.year || String(currentYear));
  const monthFilter = searchParams?.month ? parseInt(searchParams.month) : null;
  const statusFilter = searchParams?.status || null;

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name), drivers!driver_id(first_name, last_name)')
    .order('trip_number', { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  // Простая фильтрация (без search по тексту — потом добавим)
  const filteredTrips = (trips || []).filter((t: any) => {
    if (statusFilter && t.status !== statusFilter) return false;

    const date = t.end_date || t.start_date;
    if (!date) return true; // черновики показываем

    const d = new Date(date);
    if (d.getFullYear() !== year) return false;
    if (monthFilter && d.getMonth() + 1 !== monthFilter) return false;
    return true;
  });

  const tripYears = new Set<number>();
  trips?.forEach((t) => {
    const date = t.end_date || t.start_date;
    if (date) tripYears.add(new Date(date).getFullYear());
  });
  tripYears.add(currentYear);
  const years = Array.from(tripYears).sort((a, b) => b - a);

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-brand-50 text-brand-700 border-brand-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const statusStripColors: Record<string, string> = {
    planned: 'bg-slate-300',
    active: 'bg-brand-500',
    completed: 'bg-green-500',
    invoiced: 'bg-yellow-500',
    paid: 'bg-emerald-500',
  };

  const statusOrder = ['planned', 'active', 'completed', 'invoiced', 'paid'];

  function buildUrl(overrides: {
    year?: number;
    month?: number | null;
    status?: string | null;
  }): string {
    const params = new URLSearchParams();
    const y = overrides.year !== undefined ? overrides.year : year;
    const m = overrides.month === undefined ? monthFilter : overrides.month;
    const st = overrides.status === undefined ? statusFilter : overrides.status;
    if (y) params.set('year', String(y));
    if (m) params.set('month', String(m));
    if (st) params.set('status', st);
    const s = params.toString();
    return s ? `/trips-test?${s}` : '/trips-test';
  }

  function fmtDate(d: string | null): string {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('ru-RU');
    } catch {
      return d;
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* ПРЕДУПРЕЖДЕНИЕ — тестовая страница */}
        <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={2.2} />
          <div className="min-w-0">
            <div className="font-bold text-amber-800 text-sm">
              Тестовая страница
            </div>
            <div className="text-xs text-amber-700 mt-0.5">
              Здесь мы экспериментируем с гибкой логикой рейсов — грузами и сегментами.
              Рабочая страница рейсов находится по адресу{' '}
              <a href="/trips" className="underline font-medium hover:text-amber-900">/trips</a>.
            </div>
          </div>
        </div>

        {/* ЗАГОЛОВОК */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <FlaskConical className="w-6 h-6 md:w-7 md:h-7 text-amber-600" strokeWidth={2.2} />
            Рейсы (тест)
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Всего: <b className="text-slate-700">{filteredTrips.length}</b>
          </p>
        </div>

        {/* ФИЛЬТРЫ */}
        <div className="card p-4 md:p-5 space-y-4">

          {/* Статус */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Статус</div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              <a
                href={buildUrl({ status: null })}
                className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${!statusFilter
                    ? 'bg-brand-600 text-white shadow-brand'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Все
              </a>
              {statusOrder.map((st) => (
                <a
                  key={st}
                  href={buildUrl({ status: st })}
                  className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${statusFilter === st
                      ? 'bg-brand-600 text-white shadow-brand'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {statusLabels[st]}
                </a>
              ))}
            </div>
          </div>

          {/* Год */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Год</div>
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <a
                  key={y}
                  href={buildUrl({ year: y })}
                  className={`px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all tabular-nums
                    ${y === year
                      ? 'bg-brand-600 text-white shadow-brand'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {y}
                </a>
              ))}
            </div>
          </div>

          {/* Месяц */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Месяц</div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              <a
                href={buildUrl({ month: null })}
                className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${!monthFilter
                    ? 'bg-brand-600 text-white shadow-brand'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Все
              </a>
              {monthNames.map((mn, i) => {
                const mNum = i + 1;
                return (
                  <a
                    key={mNum}
                    href={buildUrl({ month: mNum })}
                    className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${mNum === monthFilter
                        ? 'bg-brand-600 text-white shadow-brand'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {mn.slice(0, 3)}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* СПИСОК */}
        {filteredTrips.length === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Рейсов не найдено</h2>
            <p className="text-slate-500">
              Попробуйте изменить фильтры или выбрать другой период
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((trip: any) => {
              const tripExpenses = expensesByTrip[trip.id] || 0;
              const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
              const driver = pickOne<DriverRel>(trip.drivers);
              const driverName = driver
                ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || null
                : null;
              const clientName = pickName(trip.clients) || 'Не указан';

              return (
                <a
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="group card card-hover overflow-hidden active:scale-[0.99]"
                >
                  <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />

                  <div className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-400 font-medium tabular-nums">
                          № {trip.trip_number || '—'}
                        </div>
                        <div className="text-base md:text-lg font-bold text-slate-900 mt-0.5 group-hover:text-brand-600 transition-colors break-words">
                          {clientName}
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap
                                        ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {statusLabels[trip.status] || trip.status}
                      </span>
                    </div>

                    {trip.client_request_number && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 break-words">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                        <span>Заявка: <b className="text-slate-700">{trip.client_request_number}</b></span>
                      </div>
                    )}

                    <div className="flex items-start gap-1.5 text-sm text-slate-600 mb-2">
                      <RouteIcon className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" strokeWidth={2} />
                      <span className="break-words">{trip.route || '—'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
                        Старт: <b className="text-slate-700 tabular-nums">{fmtDate(trip.start_date)}</b>
                      </span>
                      {trip.end_date ? (
                        <span className="text-emerald-700 tabular-nums">
                          Финиш: <b>{fmtDate(trip.end_date)}</b>
                        </span>
                      ) : (
                        <span className="text-slate-400">Финиш: —</span>
                      )}
                    </div>

                    {driverName && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4 truncate">
                        <UserCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                        <span className="truncate">{driverName}</span>
                      </div>
                    )}

                    <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Фрахт</div>
                        <div className="text-sm font-bold text-slate-900 break-words tabular-nums">
                          {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Расходы</div>
                        <div className="text-sm font-bold text-red-500 break-words tabular-nums">
                          {tripExpenses.toFixed(0)} €
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Прибыль</div>
                        <div className={`text-sm font-bold break-words tabular-nums ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {tripProfit.toFixed(0)} €
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
