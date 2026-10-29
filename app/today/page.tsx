import { getSessionContext } from '../../lib/session';
import { can } from '../../lib/roles';
import { redirect } from 'next/navigation';
import {
  Calendar,
  MapPin,
  Flag,
  Route as RouteIcon,
} from 'lucide-react';
import { createClient } from '../../lib/supabase/admin';
import { buildRouteMap } from '../../lib/trip-route';
import EventCard from './components/EventCard';
import EmptyBlock from './components/EmptyBlock';
import TodayStats from './components/TodayStats';
import ActiveTripCard from './components/ActiveTripCard';
import TodayAttention from './components/TodayAttention';
import { todayIso, currentTimestamp } from './lib/dates';
import { pickName, pickOne, getDriverName, getTruckNumber } from './lib/relations';
import { type EventItem } from './lib/events';

export const dynamic = 'force-dynamic';
// react-hooks/purity: impure-вызовы (Date.now) нельзя делать прямо в теле
// компонента. Правило ориентировано на клиентский рендер (гидрация), а здесь
// компонент серверный и force-dynamic — расхождение с клиентом невозможно,
// поэтому impure-вызов изолирован в отдельной функции.
export default async function TodayPage() {
  const { role } = await getSessionContext();
  if (!can(role, 'today.view')) redirect('/driver');
  if (!can(role, 'today.view')) redirect('/login');

  const supabase = await createClient();
  const today = todayIso();

  // 1. РЕЙСЫ
  const { data: tripsRaw, error: tripsError } = await supabase
    .from('trips')
    .select(`
      id, trip_number, status, start_date, end_date,
      driver_id, truck_id,
      clients(name),
      drivers!driver_id(first_name, last_name, phone_by, phone_pl),
      trucks!truck_id(registration_number)
    `);

  if (tripsError) {
    console.error('[today] trips query error:', tripsError.message);
    return (
      <div className="p-8 text-red-500">
        Ошибка загрузки рейсов: {tripsError.message}
      </div>
    );
  }

  const tripIds = (tripsRaw || []).map((t: any) => t.id);

  // Сегменты — вычисляем route и from/to
  const { data: routeSegs } = tripIds.length > 0
    ? await supabase
        .from('trip_segments')
        .select('trip_id, position, from_city, from_country, to_city, to_country')
        .in('trip_id', tripIds)
    : { data: [] };

  const routeMap = buildRouteMap(routeSegs || []);

  const allTrips = (tripsRaw || []).map((t: any) => {
    const r = routeMap.get(t.id);
    return {
      ...t,
      route: r?.route || null,
      from_city: r?.from_city || null,
      from_country: r?.from_country || null,
      to_city: r?.to_city || null,
      to_country: r?.to_country || null,
    };
  });

  const tripById: Record<string, any> = {};
  allTrips.forEach((t) => {
    tripById[t.id] = t;
  });

  function isDateToday(dateStr: string | null): boolean {
    if (!dateStr) return false;
    return dateStr.slice(0, 10) === today;
  }

  const todayTripLoadings = allTrips.filter((t) => isDateToday(t.start_date));
  const todayTripUnloadings = allTrips.filter((t) => isDateToday(t.end_date));
  const activeTrips = allTrips.filter((t) => t.status === 'active');

  // 2. ПОДРЯДЧИКИ — участки-подрядчики в рейсах
  const { data: subs } = await supabase
    .from('trip_segments')
    .select(`
      id, trip_id, position,
      date_from, from_city, from_country, from_company,
      date_to, to_city, to_country, to_company,
      stops,
      contractors(name)
    `)
    .eq('executor_type', 'contractor');

  const subEventsToday: EventItem[] = [];
  (subs || []).forEach((s: any) => {
    const trip = tripById[s.trip_id];
    const tripNumber = trip?.trip_number ? `№${trip.trip_number}` : '—';
    const clientName = pickName(trip?.clients) || null;

    if (s.date_from === today) {
      subEventsToday.push({
        kind: 'sub',
        tripNumber,
        clientName,
        company: s.from_company || pickName(s.contractors) || null,
        city: s.from_city,
        country: s.from_country,
        date: s.date_from,
        pointLabel: 'A1',
        href: `/trips/${s.trip_id}`,
      });
    }

    const stops = Array.isArray(s.stops) ? s.stops : [];
    stops.forEach((stop: any, idx: number) => {
      if (stop.date !== today) return;
      subEventsToday.push({
        kind: 'sub',
        tripNumber,
        clientName,
        company: stop.company || pickName(s.contractors) || null,
        city: stop.city,
        country: stop.country,
        date: stop.date,
        pointLabel: stop.type === 'unload' ? 'C' : `A${idx + 2}`,
        href: `/trips/${s.trip_id}`,
      });
    });

    if (s.date_to === today) {
      subEventsToday.push({
        kind: 'sub',
        tripNumber,
        clientName,
        company: s.to_company || pickName(s.contractors) || null,
        city: s.to_city,
        country: s.to_country,
        date: s.date_to,
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

  const todayLoadings: EventItem[] = [
    ...todayTripLoadings.map<EventItem>((t) => ({
      kind: 'trip',
      tripNumber: t.trip_number ? `№${t.trip_number}` : '—',
      clientName: pickName(t.clients) || null,
      company: t.from_city || null,
      city: t.from_city,
      country: t.from_country,
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
      company: t.to_city || null,
      city: t.to_city,
      country: t.to_country,
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
  
  // 3.5. ЗАВЕРШЁННЫЕ РЕЙСЫ БЕЗ ЗП
  const { data: completedTrips } = await supabase
    .from('trips')
    .select(`
      id, trip_number, end_date,
      clients(name),
      drivers!driver_id(first_name, last_name)
    `)
    .eq('status', 'completed')
    .not('driver_id', 'is', null);

  const completedTripIds = (completedTrips || []).map((t: any) => t.id);

  const { data: salaryExpenses } = completedTripIds.length > 0
    ? await supabase
        .from('trip_expenses')
        .select('trip_id')
        .eq('category', 'salary')
        .in('trip_id', completedTripIds)
    : { data: [] };

  const tripsWithSalary = new Set((salaryExpenses || []).map((e: any) => e.trip_id));

  const tripsWithoutSalary = (completedTrips || [])
    .filter((t: any) => !tripsWithSalary.has(t.id))
    .map((t: any) => ({
      id: t.id,
      trip_number: t.trip_number,
      end_date: t.end_date,
      clientName: pickName(t.clients) || null,
      driverName: getDriverName(t.drivers),
    }));

  // 4. ВНИМАНИЕ
  const { data: remindersRaw } = await supabase
    .from('reminders')
    .select('id, title, due_date, status')
    .neq('status', 'done')
    .order('due_date', { ascending: true });

  const overdueReminders: { id: string; title: string; days: number }[] = [];
  (remindersRaw || []).forEach((r) => {
    if (!r.due_date) return;
     
    const days = Math.ceil((new Date(r.due_date).getTime() - currentTimestamp()) / (1000 * 60 * 60 * 24));
    if (days < 0) overdueReminders.push({ id: r.id, title: r.title || '', days });
  });

  const tripsWithoutDriver = allTrips.filter(
    (t) => (t.status === 'active' || t.status === 'planned') && !t.driver_id
  );
  const tripsWithoutTruck = allTrips.filter(
    (t) => (t.status === 'active' || t.status === 'planned') && !t.truck_id
  );

  const attentionCount =
    overdueReminders.length +
    tripsWithoutDriver.length +
    tripsWithoutTruck.length +
    tripsWithoutSalary.length;

  const todayHuman = new Date().toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });

  const activeTripCards = activeTrips.map((t) => ({
    id: t.id,
    trip_number: t.trip_number,
    route: t.route,
    start_date: t.start_date,
    clientName: pickName(t.clients) || null,
    driverName: getDriverName(t.drivers),
    truckNumber: getTruckNumber(t.trucks),
  }));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Calendar className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Сегодня
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base first-letter:uppercase">
            {todayHuman}
          </p>
        </div>

        <TodayStats
          loadings={todayLoadings.length}
          unloadings={todayUnloadings.length}
          active={activeTrips.length}
          attention={attentionCount}
        />

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
              {activeTripCards.map((trip) => (
                <ActiveTripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>

        <TodayAttention
          overdueReminders={overdueReminders}
          tripsWithoutDriver={tripsWithoutDriver}
          tripsWithoutTruck={tripsWithoutTruck}
          tripsWithoutSalary={tripsWithoutSalary}
        />

      </div>
    </main>
  );
}
