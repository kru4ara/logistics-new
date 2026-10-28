import Link from 'next/link';
import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/admin';
import { buildRouteMap, type SegmentRouteRow } from '../../lib/trip-route';
import DownloadButton, { type ReportRow } from './DownloadButton';
import {
  Coins,
  BarChart3,
  Download,
  Truck,
  TrendingUp,
  TrendingDown,
  Wallet,
  Route as RouteIcon,
  Inbox,
  RadioTower,
  Filter,
  Package,
  type LucideIcon,
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

type QuickLink = {
  href: string;
  title: string;
  hint: string;
  Icon: LucideIcon;
  gradient: string;
};

const QUICK_LINKS: QuickLink[] = [
  {
    href: '/reports/profitability',
    title: 'Прибыльность',
    hint: 'Кто из клиентов и какая техника приносят деньги',
    Icon: BarChart3,
    gradient: 'from-brand-600 to-brand-800',
  },
  {
  href: '/reports/cargo',
  title: 'Фрахт по грузам',
  hint: 'Прибыльность каждого груза с распределением расходов',
  Icon: Package,
  gradient: 'from-blue-600 to-blue-800',
  },
  {
    href: '/reports/logisat',
    title: 'Ошибки Logisat',
    hint: 'Проблемы синхронизации: нет данных, сломан одометр или датчик топлива',
    Icon: RadioTower,
    gradient: 'from-orange-500 to-orange-700',
  },
  {
    href: '/reports/excel',
    title: 'Экспорт в Excel',
    hint: 'Рейсы · Расходы · Экспедирование · Прибыльность клиентов',
    Icon: Download,
    gradient: 'from-emerald-600 to-emerald-800',
  },
  {
    href: '/reports/contractors',
    title: 'Подрядчики',
    hint: 'Сколько кому заплатили: рейсы + экспедирование',
    Icon: Truck,
    gradient: 'from-violet-600 to-violet-800',
  },
];

const STATUS_OPTIONS = [
  { value: 'money', label: 'Оплаченные + выставленные' },
  { value: 'completed', label: 'Завершённые + деньги' },
  { value: 'active', label: 'В пути' },
  { value: 'planned', label: 'Планируются' },
  { value: 'all', label: 'Все' },
];

const STATUS_MAP: Record<string, string[]> = {
  money: ['paid', 'invoiced'],
  completed: ['completed', 'invoiced', 'paid'],
  active: ['active'],
  planned: ['planned'],
  all: [],
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; client?: string }>;
}) {
  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');

  const resolvedParams = await searchParams;
  const supabase = await createClient();

  // Параметры фильтров
  const from = resolvedParams.from || '';
  const to = resolvedParams.to || '';
  const statusKey = resolvedParams.status || 'money';
  const clientId = resolvedParams.client || '';

  const statuses = STATUS_MAP[statusKey] ?? STATUS_MAP.money;

  // 1. Запрос рейсов с фильтрами
  let tripsQuery = supabase
    .from('trips')
    .select('*, clients(name)')
    .order('trip_number', { ascending: false });

  if (from) tripsQuery = tripsQuery.gte('start_date', from);
  if (to) tripsQuery = tripsQuery.lte('start_date', to);
  if (statuses.length > 0) tripsQuery = tripsQuery.in('status', statuses);
  if (clientId) tripsQuery = tripsQuery.eq('client_id', clientId);

  const { data: trips, error: tripsError } = await tripsQuery;

  if (tripsError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {tripsError.message}</div>;
  }

  // 2. Сегменты для маршрута
  const { data: segmentsData } = await supabase
    .from('trip_segments')
    .select('trip_id, position, from_city, from_country, to_city, to_country');

  const segments = (segmentsData || []) as SegmentRouteRow[];
  const routeByTrip = buildRouteMap(segments);

  // 3. Расходы только по отфильтрованным рейсам
  const tripIds = (trips || []).map((t) => t.id).filter(Boolean) as string[];

  let expenses: { trip_id: string | null; amount_eur: number | null }[] = [];
  if (tripIds.length > 0) {
    const { data, error } = await supabase
      .from('trip_expenses')
      .select('trip_id, amount_eur')
      .in('trip_id', tripIds);
    if (error) {
      return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
    }
    expenses = data || [];
  }

  const expensesByTrip = expenses.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>);

  // 4. Итоги
  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount_eur || 0), 0);
  const profit = totalRevenue - totalExpenses;

  // 5. Строки отчёта
  const reportRows: ReportRow[] = (trips || []).map((trip) => ({
    id: trip.id,
    trip_number: trip.trip_number ?? null,
    clientName: pickName(trip.clients) || 'Не указан',
    route: routeByTrip.get(trip.id)?.route || '—',
    status: trip.status,
    revenue_eur: trip.revenue_eur || 0,
    expenses: expensesByTrip[trip.id] || 0,
  }));

  // 6. Список клиентов для фильтра
  const { data: clientsList } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700',
    active: 'bg-brand-50 text-brand-700',
    completed: 'bg-green-50 text-green-700',
    invoiced: 'bg-yellow-50 text-yellow-700',
    paid: 'bg-emerald-50 text-emerald-700',
  };

  const hasFilters = Boolean(from || to || clientId || statusKey !== 'money');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Coins className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Отчёт о прибыли
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Полная финансовая сводка по всем рейсам
            </p>
          </div>
          <DownloadButton data={reportRows} />
        </div>

        {/* Быстрые ссылки */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map(({ href, title, hint, Icon, gradient }) => (
            <Link
              key={href}
              href={href}
              className={`block bg-gradient-to-br ${gradient} rounded-2xl shadow-lg p-5 md:p-6
                         text-white hover:shadow-xl hover:brightness-110
                         transition-all duration-200 active:scale-[0.99]`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 backdrop-blur-sm
                                flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg md:text-xl font-bold">{title}</div>
                  <div className="text-sm text-white/80 mt-1">{hint}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Фильтры */}
        <form className="card p-4 md:p-5" method="GET">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-500" strokeWidth={2.2} />
            <span className="text-sm font-semibold text-slate-700">Фильтры</span>
            {hasFilters && (
              <span className="text-xs text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full font-medium">
                Активны
              </span>
            )}
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">С даты</label>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">По дату</label>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Статус</label>
              <select name="status" defaultValue={statusKey} className="input">
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Клиент</label>
              <select name="client" defaultValue={clientId} className="input">
                <option value="">— Все клиенты —</option>
                {(clientsList || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="submit"
              className="flex-1 md:flex-none md:px-6 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg transition-all active:scale-[0.98]"
            >
              Показать
            </button>
            {hasFilters && (
              <Link
                href="/reports"
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-all whitespace-nowrap"
              >
                Сброс
              </Link>
            )}
          </div>
        </form>

        {/* Счётчики */}
        <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-3">
          <div className="card p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Общий фрахт</span>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-green-600" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-xl md:text-3xl font-bold text-green-600 break-words tabular-nums">
              {totalRevenue.toFixed(2)} €
            </div>
          </div>

          <div className="card p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Расходы</span>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-500" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-xl md:text-3xl font-bold text-red-500 break-words tabular-nums">
              {totalExpenses.toFixed(2)} €
            </div>
          </div>

          <div className="card p-4 md:p-6 col-span-2 md:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs md:text-sm font-medium text-slate-500">Чистая прибыль</span>
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center
                ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <Wallet className={`w-4 h-4 md:w-5 md:h-5 ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`} strokeWidth={2.2} />
              </div>
            </div>
            <div className={`text-xl md:text-3xl font-bold break-words tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {profit.toFixed(2)} €
            </div>
          </div>
        </div>

        {/* Таблица / карточки */}
        <div className="card overflow-hidden">
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between gap-3">
            <h2 className="text-base md:text-lg font-bold text-slate-900">
              Детализация по рейсам
            </h2>
            <span className="text-xs md:text-sm text-slate-500">
              Найдено: <b className="text-slate-700">{reportRows.length}</b>
            </span>
          </div>

          {reportRows.length === 0 ? (
            <div className="p-10 md:p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-brand-500" strokeWidth={1.5} />
              </div>
              <p className="text-slate-500 text-sm">Нет рейсов по выбранным фильтрам</p>
              {hasFilters && (
                <Link href="/reports" className="text-brand-600 text-sm font-medium mt-3 inline-block hover:underline">
                  Сбросить фильтры
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: карточки */}
              <div className="md:hidden divide-y divide-slate-100">
                {reportRows.map((trip) => {
                  const tripProfit = trip.revenue_eur - trip.expenses;
                  return (
                    <Link
                      key={trip.id}
                      href={`/trips/${trip.id}`}
                      className="block p-4 hover:bg-slate-50 active:bg-brand-50/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <div className="text-xs text-slate-400 font-medium tabular-nums">
                            Рейс № {trip.trip_number || '—'}
                          </div>
                          <div className="font-semibold text-slate-800 break-words">
                            {trip.clientName}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${statusColors[trip.status] || 'bg-slate-100 text-slate-700'}`}>
                          {statusLabels[trip.status] || trip.status}
                        </span>
                      </div>

                      {trip.route && trip.route !== '—' && (
                        <div className="flex items-start gap-1 text-xs text-slate-500 mb-2 break-words">
                          <RouteIcon className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" strokeWidth={2} />
                          <span>{trip.route}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Фрахт</div>
                          <div className="text-sm font-bold text-green-600 break-words tabular-nums">
                            {trip.revenue_eur.toFixed(0)} €
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Расходы</div>
                          <div className="text-sm font-bold text-red-500 break-words tabular-nums">
                            {trip.expenses.toFixed(0)} €
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Прибыль</div>
                          <div className={`text-sm font-bold break-words tabular-nums ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tripProfit.toFixed(0)} €
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}

                {/* Итог мобильный */}
                <div className="p-4 bg-slate-100 border-t-2 border-slate-200">
                  <div className="font-bold text-slate-900 mb-3">ИТОГО</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 font-medium">Фрахт</div>
                      <div className="text-base font-bold text-green-600 break-words tabular-nums">{totalRevenue.toFixed(0)} €</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 font-medium">Расходы</div>
                      <div className="text-base font-bold text-red-500 break-words tabular-nums">{totalExpenses.toFixed(0)} €</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 font-medium">Прибыль</div>
                      <div className={`text-base font-bold break-words tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {profit.toFixed(0)} €
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop: таблица */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">№</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Клиент</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Маршрут</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Фрахт</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Расходы</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Прибыль</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((trip) => {
                      const tripProfit = trip.revenue_eur - trip.expenses;
                      return (
                        <tr key={trip.id} className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 font-medium tabular-nums">
                            {trip.trip_number || '—'}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            <Link href={`/trips/${trip.id}`} className="hover:text-brand-600 transition-colors">
                              {trip.clientName}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {trip.route}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[trip.status] || 'bg-slate-100 text-slate-700'}`}>
                              {statusLabels[trip.status] || trip.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-green-600 whitespace-nowrap tabular-nums">
                            {trip.revenue_eur.toFixed(2)} €
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-red-500 whitespace-nowrap tabular-nums">
                            {trip.expenses.toFixed(2)} €
                          </td>
                          <td className={`px-6 py-4 text-right font-bold whitespace-nowrap tabular-nums ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {tripProfit.toFixed(2)} €
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td colSpan={4} className="px-6 py-4 font-bold text-slate-900">
                        ИТОГО
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-green-600 tabular-nums">
                        {totalRevenue.toFixed(2)} €
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-red-500 tabular-nums">
                        {totalExpenses.toFixed(2)} €
                      </td>
                      <td className={`px-6 py-4 text-right font-bold text-lg tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {profit.toFixed(2)} €
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
