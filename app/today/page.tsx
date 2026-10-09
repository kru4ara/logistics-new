import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Flag,
  Truck,
  AlertTriangle,
  Clock,
  ArrowRight,
  UserCircle,
  Inbox,
  Route as RouteIcon,
} from 'lucide-react';
import { createClient } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDateRu(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

// Supabase relation может прийти как объект или как массив из 1 элемента.
// Возвращаем первый элемент, если массив.
function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

type DriverRel = { first_name: string | null; last_name: string | null };
type TruckRel = { registration_number: string | null };

function getDriverName(rel: unknown): string | null {
  const d = pickOne<DriverRel>(rel);
  if (!d) return null;
  const name = `${d.first_name || ''} ${d.last_name || ''}`.trim();
  return name || null;
}

function getTruckNumber(rel: unknown): string | null {
  const t = pickOne<TruckRel>(rel);
  return t?.registration_number || null;
}

type EventItem = {
  kind: 'trip' | 'sub' | 'fwd';
  tripNumber: string | null;
  clientName: string | null;
  company: string | null;
  city: string | null;
  country: string | null;
  date: string | null;
  pointLabel?: string;
  driverName?: string | null;
  truckNumber?: string | null;
  href: string;
  tripStatus?: string | null;
};

export default async function TodayPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();
  const today = todayIso();

  // 1. РЕЙСЫ
  const { data: trips } = await supabase
    .from('trips')
    .select(`
      id, trip_number, status, route, start_date, end_date,
      sender_city, sender_country,
      receiver_city, receiver_country,
      driver_id, truck_id,
      clients(name),
      drivers!driver_id(first_name, last_name, phone),
      trucks!truck_id(registration_number)
    `);

  const allTrips = trips || [];

  const tripById: Record<string, any> = {};
  allTrips.forEach((t) => {
    tripById[t.id] = t;
  });

  const todayTripLoadings = allTrips.filter((t) => t.start_date === today);
  const todayTripUnloadings = allTrips.filter((t) => t.end_date === today);
  const activeTrips = allTrips.filter((t) => t.status === 'active');

  // 2. ПОДРЯДЧИКИ
  const { data: subs } = await supabase
    .from('trip_subcontractors')
    .select(`
      id, trip_id, position,
      load_date, load_city, load_country, load_company,
      load2_date, load2_city, load2_country, load2_company,
      load3_date, load3_city, load3_country, load3_company,
      load4_date, load4_city, load4_country, load4_company,
      load5_date, load5_city, load5_country, load5_company,
      unload_date, unload_city, unload_country, unload_company,
      contractors(name)
    `)
    .or(
      `load_date.eq.${today},load2_date.eq.${today},load3_date.eq.${today},load4_date.eq.${today},load5_date.eq.${today},unload_date.eq.${today}`
    );

  const subEventsToday: EventItem[] = [];
  (subs || []).forEach((s: any) => {
    const trip = tripById[s.trip_id];
    const tripNumber = trip?.trip_number ? `№${trip.trip_number}` : '—';
    const clientName = pickName(trip?.clients) || null;

    const loads: [string | null, string | null, string | null, string | null][] = [
      [s.load_date, s.load_city, s.load_country, s.load_company],
      [s.load2_date, s.load2_city, s.load2_country, s.load2_company],
      [s.load3_date, s.load3_city, s.load3_country, s.load3_company],
      [s.load4_date, s.load4_city, s.load4_country, s.load4_company],
      [s.load5_date, s.load5_city, s.load5_country, s.load5_company],
    ];

    loads.forEach(([date, city, country, company], idx) => {
      if (date !== today) return;
      subEventsToday.push({
        kind: 'sub',
        tripNumber,
        clientName,
        company: company || pickName(s.contractors) || null,
        city,
        country,
        date,
        pointLabel: `A${idx + 1}`,
        href: `/trips/${s.trip_id}`,
      });
    });

    if (s.unload_date === today) {
      subEventsToday.push({
        kind: 'sub',
        tripNumber,
        clientName,
        company: s.unload_company || pickName(s.contractors) || null,
        city: s.unload_city,
        country: s.unload_country,
        date: s.unload_date,
        pointLabel: 'C',
        href: `/trips/${s.trip_id}`,
      });
    }
  });

  // 3. ЭКСПЕДИРОВАНИЕ
  const { data: fwdPoints } = await supabase
    .from('forwarding_points')
    .select(`
      id, forwarding_id, type, sequence, date, loading_number,
      locations(name, city, country, company_name),
      forwarding_orders!forwarding_id(order_number, clients(name))
    `)
    .eq('date', today);

  const fwdEventsToday: EventItem[] = (fwdPoints || []).map((p: any) => {
    const loc = pickOne<{ name: string | null; city: string | null; country: string | null; company_name: string | null }>(p.locations);
    const order = pickOne<{ order_number: number | null; clients: unknown }>(p.forwarding_orders);
    const orderNumber = order?.order_number ? `№${order.order_number}` : '—';
    const clientName = pickName(order?.clients) || null;
    return {
      kind: 'fwd' as const,
      tripNumber: orderNumber,
      clientName,
      company: loc?.company_name || loc?.name || null,
      city: loc?.city || null,
      country: loc?.country || null,
      date: p.date,
      pointLabel: p.type === 'loading' ? 'Загрузка' : 'Выгрузка',
      href: `/forwarding/${p.forwarding_id}`,
    };
  });

  // Сборка списков
  const todayLoadings: EventItem[] = [
    ...todayTripLoadings.map<EventItem>((t) => ({
      kind: 'trip',
      tripNumber: t.trip_number ? `№${t.trip_number}` : '—',
      clientName: pickName(t.clients) || null,
      company: t.sender_city || null,
      city: t.sender_city,
      country: t.sender_country,
      date: t.start_date,
      pointLabel: 'Старт рейса',
      driverName: getDriverName(t.drivers),
      truckNumber: getTruckNumber(t.trucks),
      href: `/trips/${t.id}`,
      tripStatus: t.status,
    })),
    ...subEventsToday.filter((e) => e.pointLabel !== 'C'),
    ...fwdEventsToday.filter((e) => e.pointLabel === 'Загрузка'),
  ];

  const todayUnloadings: EventItem[] = [
    ...todayTripUnloadings.map<EventItem>((t) => ({
      kind: 'trip',
      tripNumber: t.trip_number ? `№${t.trip_number}` : '—',
      clientName: pickName(t.clients) || null,
      company: t.receiver_city || null,
      city: t.receiver_city,
      country: t.receiver_country,
      date: t.end_date,
      pointLabel: 'Финиш рейса',
      driverName: getDriverName(t.drivers),
      truckNumber: getTruckNumber(t.trucks),
      href: `/trips/${t.id}`,
      tripStatus: t.status,
    })),
    ...subEventsToday.filter((e) => e.pointLabel === 'C'),
    ...fwdEventsToday.filter((e) => e.pointLabel === 'Выгрузка'),
  ];

  // 4. ВНИМАНИЕ
  const { data: remindersRaw } = await supabase
    .from('reminders')
    .select('id, title, due_date, status')
    .neq('status', 'done')
    .order('due_date', { ascending: true });

  const overdueReminders: { id: string; title: string; days: number }[] = [];
  (remindersRaw || []).forEach((r) => {
    if (!r.due_date) return;
    const days = Math.ceil((new Date(r.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) overdueReminders.push({ id: r.id, title: r.title || '', days });
  });

  const tripsWithoutDriver = allTrips.filter(
    (t) => (t.status === 'active' || t.status === 'planned') && !t.driver_id
  );
  const tripsWithoutTruck = allTrips.filter(
    (t) => (t.status === 'active' || t.status === 'planned') && !t.truck_id
  );

  const attentionCount =
    overdueReminders.length + tripsWithoutDriver.length + tripsWithoutTruck.length;

  const todayHuman = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

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

  function EventCard({ e, accent }: { e: EventItem; accent: 'load' | 'unload' }) {
    const accentBorder = accent === 'load' ? 'border-l-green-500' : 'border-l-red-500';
    const accentBg = accent === 'load' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
    const Icon = accent === 'load' ? MapPin : Flag;

    return (
      <Link
        href={e.href}
        className={`group block card card-hover overflow-hidden border-l-4 ${accentBorder} active:scale-[0.99]`}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${accentBg}`}>
                <Icon className="w-3 h-3" strokeWidth={2.5} />
                {e.pointLabel}
              </span>
              <span className="text-xs text-slate-400 font-medium tabular-nums">
                Рейс {e.tripNumber}
              </span>
            </div>
            {e.tripStatus && (
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap
                                ${statusColors[e.tripStatus] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {statusLabels[e.tripStatus] || e.tripStatus}
              </span>
            )}
          </div>

          {e.clientName && (
            <div className="font-bold text-slate-900 text-sm break-words group-hover:text-brand-600 transition-colors mb-1">
              {e.clientName}
            </div>
          )}

          {e.company && (
            <div className="text-sm text-slate-700 break-words">{e.company}</div>
          )}

          <div className="text-xs text-slate-500 mt-1 break-words">
            {[e.city, e.country].filter(Boolean).join(', ') || '—'}
          </div>

          {(e.driverName || e.truckNumber) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
              {e.truckNumber && (
                <span className="inline-flex items-center gap-1">
                  <Truck className="w-3 h-3" strokeWidth={2} />
                  <b className="text-slate-700">{e.truckNumber}</b>
                </span>
              )}
              {e.driverName && (
                <span className="inline-flex items-center gap-1">
                  <UserCircle className="w-3 h-3" strokeWidth={2} />
                  {e.driverName}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  }

  function EmptyBlock({ text }: { text: string }) {
    return (
      <div className="card p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-slate-50 flex items-center justify-center">
          <Inbox className="w-6 h-6 text-slate-300" strokeWidth={1.5} />
        </div>
        <div className="text-sm text-slate-400">{text}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* ЗАГОЛОВОК */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Calendar className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Сегодня
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base first-letter:uppercase">
            {todayHuman}
          </p>
        </div>

        {/* KPI */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          <div className="card card-hover p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Загрузок</span>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-green-50 flex items-center justify-center">
                <MapPin className="w-4 h-4 md:w-[18px] md:h-[18px] text-green-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-green-600 tabular-nums">
              {todayLoadings.length}
            </div>
          </div>

          <div className="card card-hover p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Выгрузок</span>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <Flag className="w-4 h-4 md:w-[18px] md:h-[18px] text-red-500" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-500 tabular-nums">
              {todayUnloadings.length}
            </div>
          </div>

          <div className="card card-hover p-4 md:p-5">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">В пути</span>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <RouteIcon className="w-4 h-4 md:w-[18px] md:h-[18px] text-brand-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
              {activeTrips.length}
            </div>
          </div>

          <div className={`card card-hover p-4 md:p-5 ${attentionCount > 0 ? 'border-amber-200' : ''}`}>
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <span className={`text-xs md:text-sm font-medium ${attentionCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                Требует внимания
              </span>
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center
                ${attentionCount > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
                <AlertTriangle className={`w-4 h-4 md:w-[18px] md:h-[18px] ${attentionCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} strokeWidth={2.2} />
              </div>
            </div>
            <div className={`text-2xl md:text-3xl font-bold tabular-nums ${attentionCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {attentionCount}
            </div>
          </div>
        </div>

        {/* ЗАГРУЗКИ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" strokeWidth={2.2} />
            Загрузки сегодня
            {todayLoadings.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {todayLoadings.length}
              </span>
            )}
          </h2>

          {todayLoadings.length === 0 ? (
            <EmptyBlock text="Сегодня загрузок не запланировано" />
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {todayLoadings.map((e, i) => (
                <EventCard key={`load-${i}`} e={e} accent="load" />
              ))}
            </div>
          )}
        </div>

        {/* ВЫГРУЗКИ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" strokeWidth={2.2} />
            Выгрузки сегодня
            {todayUnloadings.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {todayUnloadings.length}
              </span>
            )}
          </h2>

          {todayUnloadings.length === 0 ? (
            <EmptyBlock text="Сегодня выгрузок не запланировано" />
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {todayUnloadings.map((e, i) => (
                <EventCard key={`unload-${i}`} e={e} accent="unload" />
              ))}
            </div>
          )}
        </div>

        {/* В ПУТИ */}
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <RouteIcon className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
            В пути сейчас
            {activeTrips.length > 0 && (
              <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium tabular-nums">
                {activeTrips.length}
              </span>
            )}
          </h2>

          {activeTrips.length === 0 ? (
            <EmptyBlock text="Активных рейсов сейчас нет" />
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {activeTrips.map((t) => {
                const clientName = pickName(t.clients) || '—';
                const driverName = getDriverName(t.drivers);
                const truckNumber = getTruckNumber(t.trucks);
                return (
                  <Link
                    key={t.id}
                    href={`/trips/${t.id}`}
                    className="group card card-hover overflow-hidden active:scale-[0.99]"
                  >
                    <div className="h-1.5 bg-brand-500" />
                    <div className="p-4">
                      <div className="text-xs text-slate-400 font-medium tabular-nums mb-1">
                        № {t.trip_number || '—'}
                      </div>
                      <div className="font-bold text-slate-900 text-sm break-words group-hover:text-brand-600 transition-colors mb-2">
                        {clientName}
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-slate-600 mb-3">
                        <RouteIcon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" strokeWidth={2} />
                        <span className="break-words">{t.route || '—'}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-slate-100 text-xs text-slate-500">
                        {truckNumber && (
                          <span className="inline-flex items-center gap-1">
                            <Truck className="w-3 h-3" strokeWidth={2} />
                            <b className="text-slate-700">{truckNumber}</b>
                          </span>
                        )}
                        {driverName && (
                          <span className="inline-flex items-center gap-1">
                            <UserCircle className="w-3 h-3" strokeWidth={2} />
                            {driverName}
                          </span>
                        )}
                        {t.start_date && (
                          <span className="inline-flex items-center gap-1 ml-auto tabular-nums">
                            {fmtDateRu(t.start_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ТРЕБУЕТ ВНИМАНИЯ */}
        {attentionCount > 0 && (
          <div className="card border-l-4 border-l-amber-500 p-5 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={2.2} />
              Требует внимания
            </h2>

            <div className="space-y-4">
              {overdueReminders.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-red-600 font-semibold mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" strokeWidth={2.2} />
                    Просроченные напоминания · {overdueReminders.length}
                  </div>
                  <div className="space-y-1.5">
                    {overdueReminders.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="truncate">{r.title}</span>
                        <span className="ml-auto text-xs text-red-600 whitespace-nowrap tabular-nums">
                          {Math.abs(r.days)} дн.
                        </span>
                      </div>
                    ))}
                    {overdueReminders.length > 5 && (
                      <Link href="/reminders" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1 pl-4">
                        и ещё {overdueReminders.length - 5}
                        <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {(tripsWithoutDriver.length > 0 || tripsWithoutTruck.length > 0) && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-2">
                    Рейсы без назначения · {tripsWithoutDriver.length + tripsWithoutTruck.length}
                  </div>
                  <div className="space-y-1.5">
                    {tripsWithoutDriver.slice(0, 3).map((t) => (
                      <Link
                        key={`nd-${t.id}`}
                        href={`/trips/${t.id}`}
                        className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">№{t.trip_number || '—'} · {pickName(t.clients) || '—'}</span>
                        <span className="ml-auto text-xs text-amber-600 whitespace-nowrap">
                          нет водителя
                        </span>
                      </Link>
                    ))}
                    {tripsWithoutTruck.slice(0, 3).map((t) => (
                      <Link
                        key={`nt-${t.id}`}
                        href={`/trips/${t.id}`}
                        className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">№{t.trip_number || '—'} · {pickName(t.clients) || '—'}</span>
                        <span className="ml-auto text-xs text-amber-600 whitespace-nowrap">
                          нет машины
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
