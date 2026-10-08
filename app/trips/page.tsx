import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import DownloadButton from './DownloadButton';
import SearchInput from './SearchInput';

export const dynamic = 'force-dynamic';

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string; q?: string; status?: string };
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
  const hasExtraFilter = Boolean(q) || Boolean(statusFilter);

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

  // ============================================================
  // Фильтрация: поиск + статус + год/месяц
  // ============================================================
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

  // Черновики (без даты) — показываются отдельным блоком только в обычном режиме.
  // При активном поиске/статусе они попадают в общий список.
  const tripsWithoutDate = (trips || []).filter(
    (t) => !t.start_date && !t.end_date && !hasExtraFilter
  );

  // Рейсы с датой — фильтруем по году/месяцу, но игнорируем эти фильтры
  // при активном поиске (пользователь ищет конкретное — неважно за какой год).
  const filteredTrips = (trips || []).filter((t) => {
    if (!matchesSearch(t)) return false;
    if (!matchesStatus(t)) return false;

    const date = t.end_date || t.start_date;
    if (!date) {
      // Черновик: попадает в этот список только при активном поиске/статусе
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
      // Черновики при активном поиске — в отдельную группу "без даты"
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

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  const statusStripColors: Record<string, string> = {
    planned: 'bg-slate-300',
    active: 'bg-blue-500',
    completed: 'bg-green-500',
    invoiced: 'bg-yellow-500',
    paid: 'bg-emerald-500',
  };

  const statusPillColors: Record<string, string> = {
    planned: 'bg-slate-500',
    active: 'bg-blue-500',
    completed: 'bg-green-500',
    invoiced: 'bg-yellow-500',
    paid: 'bg-emerald-500',
  };

  const statusOrder = ['planned', 'active', 'completed', 'invoiced', 'paid'];

  const filteredRevenue = filteredTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
  const filteredExpenses = filteredTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);
  const filteredProfit = filteredRevenue - filteredExpenses;

  // Хелпер для построения URL с сохранением всех фильтров
  function buildUrl(overrides: {
    year?: number;
    month?: number | null;
    q?: string | null;
    status?: string | null;
  }): string {
    const params = new URLSearchParams();
    const y = overrides.year !== undefined ? overrides.year : year;
    const m = overrides.month === undefined ? monthFilter : overrides.month;
    const qq = overrides.q === undefined ? (q || null) : overrides.q;
    const st = overrides.status === undefined ? statusFilter : overrides.status;
    if (y) params.set('year', String(y));
    if (m) params.set('month', String(m));
    if (qq) params.set('q', qq);
    if (st) params.set('status', st);
    const s = params.toString();
    return s ? `/trips?${s}` : '/trips';
  }

  // ============================================================
  // Рендер карточки рейса — вынесено, чтобы переиспользовать в двух местах
  // ============================================================
  function renderTripCard(trip: any) {
    const tripExpenses = expensesByTrip[trip.id] || 0;
    const tripProfit = (trip.revenue_eur || 0) - tripExpenses;
    const driver = trip.drivers;
    const clientName = pickName(trip.clients) || 'Не указан';

    return (
      <a
        key={trip.id}
        href={`/trips/${trip.id}`}
        className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                   hover:shadow-xl hover:border-blue-200 md:hover:-translate-y-0.5
                   transition-all duration-200 overflow-hidden active:scale-[0.99]"
      >
        <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />

        <div className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400 font-medium">
                № {trip.trip_number || '—'}
              </div>
              <div className="text-base md:text-lg font-bold text-slate-900 mt-0.5 group-hover:text-blue-600 transition-colors break-words">
                {clientName}
              </div>
            </div>
            <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          {trip.client_request_number && (
            <div className="text-xs text-slate-500 mb-2 break-words">
              📄 Заявка: <b className="text-slate-700">{trip.client_request_number}</b>
            </div>
          )}

          <div className="flex items-start gap-2 text-sm text-slate-600 mb-2">
            <span className="shrink-0">🛣</span>
            <span className="break-words">{trip.route || '—'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
            <span className="text-slate-500">
              🚀 Старт: <b className="text-slate-700">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
              </b>
            </span>
            {trip.end_date ? (
              <span className="text-emerald-700">
                🏁 Финиш: <b>
                  {new Date(trip.end_date).toLocaleDateString('ru-RU')}
                </b>
              </span>
            ) : (
              <span className="text-slate-400">🏁 Финиш: —</span>
            )}
          </div>

          {driver && (
            <div className="text-xs text-slate-400 mb-4 truncate">
              🚛 {driver.first_name} {driver.last_name}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Фрахт</div>
              <div className="text-sm font-bold text-slate-900 break-words">
                {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Расходы</div>
              <div className="text-sm font-bold text-red-500 break-words">
                {tripExpenses.toFixed(0)} €
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Прибыль</div>
              <div className={`text-sm font-bold break-words ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {tripProfit.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>
      </a>
    );
  }

  const totalFiltered = filteredTrips.length;
  const isSearchMode = hasExtraFilter;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📋 Рейсы</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              {isSearchMode ? (
                <>Найдено: <b>{totalFiltered}</b>{q && <> · по запросу «{q}»</>}</>
              ) : (
                <>Всего рейсов: {filteredTrips.length}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
            <DownloadButton data={filteredTrips} />
            <a
              href="/trips/new"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-4 md:px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                         transition-all duration-150 active:scale-[0.98] text-sm md:text-base"
            >
              <span>➕</span>
              <span>Создать рейс</span>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 space-y-4">

          {/* Поиск с debounce */}
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
                    ? 'bg-blue-600 text-white'
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusPillColors[st]}`} />
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
                  className={`px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all
                    ${y === year
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
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
                    ? 'bg-blue-600 text-white'
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
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {mn.slice(0, 3)}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Сводка по выбранному фильтру */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-400 font-medium">Фрахт</div>
              <div className="text-base md:text-lg font-bold text-green-600">{filteredRevenue.toFixed(0)} €</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Расходы</div>
              <div className="text-base md:text-lg font-bold text-red-500">{filteredExpenses.toFixed(0)} €</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Прибыль</div>
              <div className={`text-base md:text-lg font-bold ${filteredProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {filteredProfit.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {/* РЕЙСЫ БЕЗ ДАТЫ (черновики) — только в обычном режиме */}
        {!isSearchMode && tripsWithoutDate.length > 0 && (
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4 px-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg md:text-xl shrink-0">
                  📝
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-slate-900">
                    Без даты старта
                  </h2>
                  <div className="text-xs text-slate-400">
                    Рейсов: {tripsWithoutDate.length} · черновики, ждут назначения машины/даты
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
              {tripsWithoutDate.map((trip) => renderTripCard(trip))}
            </div>
          </div>
        )}

        {/* РЕЙСЫ С ДАТОЙ, ПО МЕСЯЦАМ */}
        {totalFiltered === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 md:p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
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
                href={buildUrl({ q: null, status: null })}
                className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700
                           font-semibold px-6 py-3 rounded-xl transition-all"
              >
                ✕ Сбросить фильтры
              </a>
            ) : (
              <a
                href="/trips/new"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                           font-semibold px-6 py-3 rounded-xl transition-all"
              >
                ➕ Создать рейс
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            {sortedMonthKeys.map((key) => {
              const group = tripsByMonth[key];
              const monthTrips = group.trips;
              const monthRevenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
              const monthExpenses = monthTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);
              const monthProfit = monthRevenue - monthExpenses;

              const isNoDate = key === 'nodate';
              const title = isNoDate ? 'Без даты старта' : `${monthNames[group.month - 1]} ${year}`;
              const icon = isNoDate ? '📝' : '📅';
              const iconBg = isNoDate ? 'bg-amber-50' : 'bg-blue-50';

              return (
                <div key={key}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4 px-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${iconBg} flex items-center justify-center text-lg md:text-xl shrink-0`}>
                        {icon}
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">
                          {title}
                        </h2>
                        <div className="text-xs text-slate-400">
                          Рейсов: {monthTrips.length}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-right">
                      <div>
                        <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Фрахт</div>
                        <div className="text-sm md:text-base font-bold text-green-600">{monthRevenue.toFixed(0)} €</div>
                      </div>
                      <div>
                        <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Расходы</div>
                        <div className="text-sm md:text-base font-bold text-red-500">{monthExpenses.toFixed(0)} €</div>
                      </div>
                      <div>
                        <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Прибыль</div>
                        <div className={`text-sm md:text-base font-bold ${monthProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {monthProfit.toFixed(0)} €
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {monthTrips.map((trip) => renderTripCard(trip))}
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
