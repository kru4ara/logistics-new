import Link from 'next/link';
import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { buildRouteMap, type SegmentRouteRow, type TripRouteInfo } from '../../lib/trip-route';
import DownloadButton from './DownloadButton';
import SearchInput from './SearchInput';
import TripFilters from './TripFilters';
import RecalcAllCoordsButton from './RecalcAllCoordsButton';
import TripsBulkList from './TripsBulkListWrapper';
import type { TripCardData, MonthGroup } from './TripsBulkList';
import {
  Package,
  Plus,
  Inbox,
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

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    q?: string;
    status?: string;
    driver?: string;
    truck?: string;
    client?: string;
    sort?: string;
  }>;
}) {
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const resolvedParams = await searchParams;

  const now = new Date();
  const currentYear = now.getFullYear();

  const year = parseInt(resolvedParams?.year || String(currentYear));
  const monthFilter = resolvedParams?.month ? parseInt(resolvedParams.month) : null;
  const q = (resolvedParams?.q || '').trim();
  const qLower = q.toLowerCase();
  const statusFilter = resolvedParams?.status || null;
  const driverFilter = resolvedParams?.driver || null;
  const truckFilter = resolvedParams?.truck || null;
  const clientFilter = resolvedParams?.client || null;
  const sortBy: 'start' | 'created' = resolvedParams?.sort === 'created' ? 'created' : 'start';
  
  const hasExtraFilter =
    Boolean(q) || Boolean(statusFilter) || Boolean(driverFilter) || Boolean(truckFilter) || Boolean(clientFilter);

  const [tripsResult, expensesResult, driversResult, tractorsResult, clientsResult, segmentsResult] = await Promise.all([
    supabase
      .from('trips')
      .select('*, clients(name), drivers!driver_id(first_name, last_name)')
      .order('trip_number', { ascending: false, nullsFirst: false }),
    supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur'),
    supabase
      .from('drivers')
      .select('id, first_name, last_name')
      .order('last_name'),
    supabase
      .from('trucks')
      .select('id, registration_number')
      .eq('type', 'tractor')
      .order('registration_number'),
    supabase
      .from('clients')
      .select('id, name')
      .order('name'),
    supabase
      .from('trip_segments')
      .select('trip_id, position, from_city, from_country, to_city, to_country'),
  ]);

  const trips = tripsResult.data;
  const tripsError = tripsResult.error;

  if (tripsError) {
    return <div className="p-8 text-red-500">Ошибка загрузки рейсов: {tripsError.message}</div>;
  }

  const expenses = expensesResult.data;
  const driversList = driversResult.data || [];
  const tractorsList = tractorsResult.data || [];
  const clientsList = clientsResult.data || [];
  const segments = segmentsResult.data || [];

  const routeMap: Map<string, TripRouteInfo> = buildRouteMap(
    segments as SegmentRouteRow[]
  );

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  function getRoute(t: any): string {
    return routeMap.get(t.id)?.route || '—';
  }

  function matchesSearch(t: any): boolean {
    if (!qLower) return true;
    const haystack = [
      t.trip_number?.toString() || '',
      t.client_request_number || '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(qLower);
  }

  function matchesStatus(t: any): boolean {
    if (!statusFilter) return true;
    return t.status === statusFilter;
  }

  function matchesDriver(t: any): boolean {
    if (!driverFilter) return true;
    return t.driver_id === driverFilter;
  }

  function matchesTruck(t: any): boolean {
    if (!truckFilter) return true;
    return t.truck_id === truckFilter;
  }

  function matchesClient(t: any): boolean {
    if (!clientFilter) return true;
    return t.client_id === clientFilter;
  }

  const filteredTrips = (trips || []).filter((t) => {
    if (!matchesSearch(t)) return false;
    if (!matchesStatus(t)) return false;
    if (!matchesDriver(t)) return false;
    if (!matchesTruck(t)) return false;
    if (!matchesClient(t)) return false;

    const date = t.end_date || t.start_date;

    if (!date) return true;

    if (hasExtraFilter) return true;

    const d = new Date(date);
    if (d.getFullYear() !== year) return false;
    if (monthFilter && d.getMonth() + 1 !== monthFilter) return false;
    return true;
  });

  if (sortBy === 'created') {
    filteredTrips.sort((a, b) => {
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bT - aT;
    });
  } else {
    filteredTrips.sort((a, b) => {
      const aD = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bD = b.start_date ? new Date(b.start_date).getTime() : 0;
      if (aD !== bD) return bD - aD;
      const aN = a.trip_number ?? 0;
      const bN = b.trip_number ?? 0;
      if (aN !== bN) return bN - aN;
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bT - aT;
    });
  }

  const filteredWithoutDate = filteredTrips.filter(
    (t) => !t.start_date && !t.end_date
  );

  const tripsByMonth: Record<string, { month: number; trips: any[] }> = {};
  filteredTrips.forEach((t) => {
    const date = t.start_date || t.end_date;
    if (!date) return;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!tripsByMonth[key]) tripsByMonth[key] = { month: d.getMonth() + 1, trips: [] };
    tripsByMonth[key].trips.push(t);
  });

  const sortedMonthKeys = Object.keys(tripsByMonth).sort((a, b) => b.localeCompare(a));

  const tripYears = new Set<number>();
  trips?.forEach((t) => {
    const date = t.end_date || t.start_date;
    if (date) tripYears.add(new Date(date).getFullYear());
  });
  tripYears.add(currentYear);
  const years = Array.from(tripYears).sort((a, b) => b - a);

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const filteredRevenue = filteredTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
  const filteredExpenses = filteredTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);
  const filteredProfit = filteredRevenue - filteredExpenses;

  function buildUrl(overrides: {
    year?: number;
    month?: number | null;
    q?: string | null;
    status?: string | null;
    driver?: string | null;
    truck?: string | null;
    client?: string | null;
    sort?: 'start' | 'created' | null;
  }): string {
    const params = new URLSearchParams();
    const y = overrides.year !== undefined ? overrides.year : year;
    const m = overrides.month === undefined ? monthFilter : overrides.month;
    const qq = overrides.q === undefined ? (q || null) : overrides.q;
    const st = overrides.status === undefined ? statusFilter : overrides.status;
    const dr = overrides.driver === undefined ? driverFilter : overrides.driver;
    const tr = overrides.truck === undefined ? truckFilter : overrides.truck;
    const cl = overrides.client === undefined ? clientFilter : overrides.client;
    const so = overrides.sort === undefined ? (sortBy === 'created' ? 'created' : null) : overrides.sort;
    if (y) params.set('year', String(y));
    if (m) params.set('month', String(m));
    if (qq) params.set('q', qq);
    if (st) params.set('status', st);
    if (dr) params.set('driver', dr);
    if (tr) params.set('truck', tr);
    if (cl) params.set('client', cl);
    if (so) params.set('sort', so);
    const s = params.toString();
    return s ? `/trips?${s}` : '/trips';
  }

  function prepareTrip(t: any): TripCardData {
    const driver = pickOne<DriverRel>(t.drivers);
    const driverName = driver
      ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || null
      : null;

    return {
      id: t.id,
      trip_number: t.trip_number ?? null,
      status: t.status,
      route: getRoute(t),
      start_date: t.start_date ?? null,
      end_date: t.end_date ?? null,
      client_request_number: t.client_request_number ?? null,
      revenue_eur: t.revenue_eur ?? null,
      expenses: expensesByTrip[t.id] || 0,
      clientName: pickName(t.clients) || 'Не указан',
      driverName,
    };
  }

  const monthGroups: MonthGroup[] = sortBy === 'created'
    ? []
    : sortedMonthKeys.map((key) => {
        const group = tripsByMonth[key];
        const mTrips = group.trips;
        const mRev = mTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
        const mExp = mTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);
        return {
          key,
          isNoDate: false,
          title: `${monthNames[group.month - 1]} ${year}`,
          trips: mTrips.map(prepareTrip),
          revenue: mRev,
          expenses: mExp,
        };
      });

  const totalFiltered = filteredTrips.length;
  const isSearchMode = hasExtraFilter;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Package className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Рейсы
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              {isSearchMode ? (
                <>Найдено: <b className="text-slate-700">{totalFiltered}</b>{q && <> · по запросу «{q}»</>}</>
              ) : (
                <>Всего рейсов: <b className="text-slate-700">{filteredTrips.length}</b></>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <RecalcAllCoordsButton tripIds={filteredTrips.map((t) => t.id)} />
            <DownloadButton data={filteredTrips.map(prepareTrip)} />
            <Link
              href="/trips/new"
              className="btn btn-primary text-sm md:text-base flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
              Создать заявку
            </Link>
          </div>
        </div>

        <div className="card p-4 md:p-5 space-y-4">
          <SearchInput
            initialQ={q}
            year={year}
            month={monthFilter}
            status={statusFilter}
          />

          <TripFilters
            clients={(clientsList || []).map((c) => ({ id: c.id, label: c.name }))}
            drivers={(driversList || []).map((d) => ({ id: d.id, label: `${d.first_name} ${d.last_name}` }))}
            tractors={(tractorsList || []).map((t) => ({ id: t.id, label: t.registration_number }))}
            years={years}
            months={monthNames}
            currentYear={year}
            currentMonth={monthFilter}
            currentClient={clientFilter}
            currentDriver={driverFilter}
            currentTruck={truckFilter}
            currentSort={sortBy}
          />

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-400 font-medium">Фрахт</div>
              <div className="text-base md:text-lg font-bold text-green-600 tabular-nums">
                {filteredRevenue.toFixed(0)} €
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Расходы</div>
              <div className="text-base md:text-lg font-bold text-red-500 tabular-nums">
                {filteredExpenses.toFixed(0)} €
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Прибыль</div>
              <div className={`text-base md:text-lg font-bold tabular-nums ${filteredProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {filteredProfit.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {totalFiltered === 0 ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {isSearchMode ? 'Ничего не найдено' : 'Рейсов не найдено'}
            </h2>
            <p className="text-slate-500 mb-6">
              {isSearchMode
                ? 'Попробуйте изменить запрос или сбросить фильтры'
                : (monthFilter ? `За ${monthNames[monthFilter - 1]} ${year} нет рейсов` : `За ${year} год нет рейсов`)}
            </p>
            {isSearchMode ? (
              <Link
                href={buildUrl({ q: null, status: null, driver: null, truck: null, client: null })}
                className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700
                           font-semibold px-6 py-3 rounded-xl transition-all"
              >
                Сбросить фильтры
              </Link>
            ) : (
              <Link
                href="/trips/new"
                className="btn btn-primary inline-flex"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Создать заявку
              </Link>
            )}
          </div>
        ) : (
          <TripsBulkList
            tripsWithoutDate={
              sortBy === 'created'
                ? filteredTrips.map(prepareTrip)
                : filteredWithoutDate.map(prepareTrip)
            }
            monthGroups={monthGroups}
            isSearchMode={isSearchMode}
            flatMode={sortBy === 'created'}
          />
        )}

      </div>
    </main>
  );
}
