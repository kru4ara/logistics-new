import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import DownloadButton from './DownloadButton';

export const dynamic = 'force-dynamic';

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

export default async function TripsPage({ searchParams }: { searchParams: { year?: string; month?: string } }) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const now = new Date();
  const currentYear = now.getFullYear();

  const year = parseInt(searchParams?.year || String(currentYear));
  const monthFilter = searchParams?.month ? parseInt(searchParams.month) : null;

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

  // Фильтруем по году и месяцу
  const filteredTrips = trips?.filter((t) => {
    const date = t.end_date || t.start_date;
    if (!date) return false;
    const d = new Date(date);
    if (d.getFullYear() !== year) return false;
    if (monthFilter && d.getMonth() + 1 !== monthFilter) return false;
    return true;
  }) || [];

  // Группируем по месяцам
  const tripsByMonth: Record<string, { month: number; trips: any[] }> = {};
  filteredTrips.forEach((t) => {
    const date = t.end_date || t.start_date;
    if (!date) return;
    const d = new Date(date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!tripsByMonth[key]) tripsByMonth[key] = { month: d.getMonth() + 1, trips: [] };
    tripsByMonth[key].trips.push(t);
  });

  const sortedMonthKeys = Object.keys(tripsByMonth).sort().reverse();

  // Список годов
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

  // Статистика по текущему фильтру
  const filteredRevenue = filteredTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
  const filteredExpenses = filteredTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);
  const filteredProfit = filteredRevenue - filteredExpenses;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📋 Рейсы</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Всего рейсов: {filteredTrips.length}</p>
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

        {/* Фильтры */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 space-y-4">
          {/* Годы */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Год</div>
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <a
                  key={y}
                  href={`/trips?year=${y}${monthFilter ? `&month=${monthFilter}` : ''}`}
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

          {/* Месяцы */}
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Месяц</div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              <a
                href={`/trips?year=${year}`}
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
                    href={`/trips?year=${year}&month=${mNum}`}
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

          {/* Итоги по фильтру */}
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

        {/* Список рейсов */}
        {filteredTrips.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 md:p-16 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Рейсов не найдено</h2>
            <p className="text-slate-500 mb-6">
              {monthFilter ? `За ${monthNames[monthFilter - 1]} ${year} нет рейсов` : `За ${year} год нет рейсов`}
            </p>
            <a
              href="/trips/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-6 py-3 rounded-xl transition-all"
            >
              ➕ Создать рейс
            </a>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            {sortedMonthKeys.map((key) => {
              const group = tripsByMonth[key];
              const monthTrips = group.trips;
              const monthRevenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
              const monthExpenses = monthTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);
              const monthProfit = monthRevenue - monthExpenses;

              return (
                <div key={key}>
                  {/* Заголовок месяца */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4 px-1">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg md:text-xl shrink-0">
                        📅
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900">
                          {monthNames[group.month - 1]} {year}
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

                  {/* Карточки рейсов */}
                  <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {monthTrips.map((trip) => {
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
                            {/* Заголовок: № + клиент + статус */}
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

                            {/* Заявка клиента */}
                            {trip.client_request_number && (
                              <div className="text-xs text-slate-500 mb-2 break-words">
                                📄 Заявка: <b className="text-slate-700">{trip.client_request_number}</b>
                              </div>
                            )}

                            {/* Маршрут */}
                            <div className="flex items-start gap-2 text-sm text-slate-600 mb-2">
                              <span className="shrink-0">🛣</span>
                              <span className="break-words">{trip.route || '—'}</span>
                            </div>

                            {/* Дата + водитель */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-4">
                              <span>
                                📅 {trip.end_date
                                  ? new Date(trip.end_date).toLocaleDateString('ru-RU')
                                  : trip.start_date
                                    ? new Date(trip.start_date).toLocaleDateString('ru-RU')
                                    : '—'}
                              </span>
                              {driver && (
                                <span className="truncate max-w-[60%]">
                                  🚛 {driver.first_name} {driver.last_name}
                                </span>
                              )}
                            </div>

                            {/* Экономика */}
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
                    })}
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
