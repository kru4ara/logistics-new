import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import DownloadButton from './DownloadButton';
import SearchInput from './SearchInput';
import TripsBulkList, { type TripCardData, type MonthGroup } from './TripsBulkList';
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
  searchParams: {
    year?: string;
    month?: string;
    q?: string;
    status?: string;
    driver?: string;
    truck?: string;
  };
}) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const now = new Date();
  const currentYear = now.getFullYear();

  const year = parseInt(searchParams?.year || String(currentYear));
  const monthFilter = searchParams?.month ? parseInt(searchParams.month) : null;
  const q = (searchParams?.q || '').trim();
  const qLower = q.toLowerCase();
  const statusFilter = searchParams?.status || null;
  const driverFilter = searchParams?.driver || null;
  const truckFilter = searchParams?.truck || null;
  const hasExtraFilter =
    Boolean(q) || Boolean(statusFilter) || Boolean(driverFilter) || Boolean(truckFilter);

  const [tripsResult, expensesResult, driversResult, tractorsResult] = await Promise.all([
    supabase
      .from('trips')
      .select('*, clients(name), drivers!driver_id(first_name, last_name)')
      .order('trip_number', { ascending: false }),
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
  ]);

  const trips = tripsResult.data;
  const tripsError = tripsResult.error;

  if (tripsError) {
    return <div className="p-8 text-red-500">Ошибка загрузки рейсов: {tripsError.message}</div>;
  }

  const expenses = expensesResult.data;
  const driversList = driversResult.data || [];
  const tractorsList = tractorsResult.data || [];

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  function matchesSearch(t: any): boolean {
    if (!qLower) return true;
    const clientName = pickName(t.clients) || '';
    const haystack = [
      t.trip_number?.toString() || '',
      t.client_request_number || '',
      t.route || '',
      t.sender_name || '',
      t.sender_city || '',
      t.sender_country || '',
      t.receiver_name || '',
      t.receiver_city || '',
      t.receiver_country || '',
      clientName,
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

  const tripsWithoutDate = (trips || []).filter(
    (t) => !t.start_date && !t.end_date && !hasExtraFilter
  );

  const filteredTrips = (trips || []).filter((t) => {
    if (!matchesSearch(t)) return false;
    if (!matchesStatus(t)) return false;
    if (!matchesDriver(t)) return false;
    if (!matchesTruck(t)) return false;

    const date = t.end_date || t.start_date;
    if (!date) {
      return hasExtraFilter;
    }

    if (hasExtraFilter) return true;

    const d = new Date(date);
    if (d.getFullYear() !== year) return false;
    if (monthFilter && d.getMonth() + 1 !== monthFilter) return false;
    return true;
  });

  const tripsByMonth: Record<string, { month: number; trips: any[] }> = {};
  filteredTrips.forEach((t) => {
    const date = t.end_date || t.start_date;
    if (!date) {
      if (!tripsByMonth['nodate']) tripsByMonth['nodate'] = { month: 0, trips: [] };
      tripsByMonth['nodate'].trips.push(t);
      return;
    }
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!tripsByMonth[key]) tripsByMonth[key] = { month: d.getMonth() + 1, trips: [] };
    tripsByMonth[key].trips.push(t);
  });

  const sortedMonthKeys = Object.keys(tripsByMonth).sort((a, b) => {
    if (a === 'nodate') return -1;
    if (b === 'nodate') return 1;
    return b.localeCompare(a);
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

  const statusPillColors: Record<string, string> = {
    planned: 'bg-slate-400',
    active: 'bg-brand-500',
    completed: 'bg-green-500',
    invoiced: 'bg-yellow-500',
    paid: 'bg-emerald-500',
  };

  const statusOrder = ['planned', 'active', 'completed', 'invoiced', 'paid'];

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
  }): string {
    const params = new URLSearchParams();
    const y = overrides.year !== undefined ? overrides.year : year;
    const m = overrides.month === undefined ? monthFilter : overrides.month;
    const qq = overrides.q === undefined ? (q || null) : overrides.q;
    const st = overrides.status === undefined ? statusFilter : overrides.status;
    const dr = overrides.driver === undefined ? driverFilter : overrides.driver;
    const tr = overrides.truck === undefined ? truckFilter : overrides.truck;
    if (y) params.set('year', String(y));
    if (m) params.set('month', String(m));
    if (qq) params.set('q', qq);
    if (st) params.set('status', st);
    if (dr) params.set('driver', dr);
    if (tr) params.set('truck', tr);
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
      route: t.route ?? null,
      start_date: t.start_date ?? null,
      end_date: t.end_date ?? null,
      client_request_number: t.client_request_number ?? null,
      revenue_eur: t.revenue_eur ?? null,
      expenses: expensesByTrip[t.id] || 0,
      clientName: pickName(t.clients) || 'Не указан',
      driverName,
    };
  }

  const monthGroups: MonthGroup[] = sortedMonthKeys.map((key) => {
    const group = tripsByMonth[key];
    const mTrips = group.trips;
    const mRev = mTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
    const mExp = mTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);
    const isNoDate = key === 'nodate';
    return {
      key,
      isNoDate,
      title: isNoDate ? 'Без даты старта' : `${monthNames[group.month - 1]} ${year}`,
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

        {/* ЗАГОЛОВОК */}
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
            <DownloadButton data={filteredTrips} />
            <a
              href="/trips/new"
              className="btn btn-primary text-sm md:text-base flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
              Создать рейс
            </a>
          </div>
        </div>

        {/* ФИЛЬТРЫ */}
        <div className="card p-4 md:p-5 space-y-4">

          <SearchInput
            initialQ={q}
            year={year}
            month={monthFilter}
            status={statusFilter}
          />

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
                  className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${statusFilter === st
                      ? 'bg-brand-600 text-white shadow-brand'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusPillColors[st]}`} />
                  {statusLabels[st]}
                </a>
              ))}
            </div>
          </div>

          {/* Водитель */}
          {driversList.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Водитель</div>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                <a
                  href={buildUrl({ driver: null })}
                  className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${!driverFilter
                      ? 'bg-brand-600 text-white shadow-brand'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  Все
                </a>
                {driversList.map((d) => (
                  <a
                    key={d.id}
                    href={buildUrl({ driver: d.id })}
                    className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${driverFilter === d.id
                        ? 'bg-brand-600 text-white shadow-brand'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {d.first_name} {d.last_name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Тягач */}
          {tractorsList.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Тягач</div>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                <a
                  href={buildUrl({ truck: null })}
                  className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                    ${!truckFilter
                      ? 'bg-brand-600 text-white shadow-brand'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  Все
                </a>
                {tractorsList.map((t) => (
                  <a
                    key={t.id}
                    href={buildUrl({ truck: t.id })}
                    className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all tabular-nums
                      ${truckFilter === t.id
                        ? 'bg-brand-600 text-white shadow-brand'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {t.registration_number}
                  </a>
                ))}
              </div>
            </div>
          )}

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

          {/* Сводка по фильтру */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
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

        {/* СПИСОК или ПУСТО */}
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
              <a
                href={buildUrl({ q: null, status: null, driver: null, truck: null })}
                className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700
                           font-semibold px-6 py-3 rounded-xl transition-all"
              >
                Сбросить фильтры
              </a>
            ) : (
              <a
                href="/trips/new"
                className="btn btn-primary inline-flex"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
                Создать рейс
              </a>
            )}
          </div>
        ) : (
          <TripsBulkList
            tripsWithoutDate={tripsWithoutDate.map(prepareTrip)}
            monthGroups={monthGroups}
            isSearchMode={isSearchMode}
          />
        )}

      </div>
    </main>
  );
}
