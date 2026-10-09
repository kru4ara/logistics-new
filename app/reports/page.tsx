import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import DownloadButton from './DownloadButton';
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

export default async function ReportsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: trips, error: tripsError } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .order('trip_number', { ascending: false });

  if (tripsError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {tripsError.message}</div>;
  }

  const { data: expenses, error: expensesError } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  if (expensesError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {expensesError.message}</div>;
  }

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  const tripsWithExpenses = trips?.map((trip) => ({
    ...trip,
    expenses: expensesByTrip[trip.id] || 0
  })) || [];

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
            <p className="text-slate-500 mt-1 text-sm md:text-base">Полная финансовая сводка по всем рейсам</p>
          </div>
          <DownloadButton data={tripsWithExpenses} />
        </div>

        {/* Быстрые ссылки */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map(({ href, title, hint, Icon, gradient }) => (
            <a
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
            </a>
          ))}
        </div>

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
          <div className="p-4 md:p-6 border-b border-slate-100">
            <h2 className="text-base md:text-lg font-bold text-slate-900">Детализация по рейсам</h2>
          </div>

          {tripsWithExpenses.length === 0 ? (
            <div className="p-10 md:p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-brand-500" strokeWidth={1.5} />
              </div>
              <p className="text-slate-500 text-sm">Рейсов пока нет</p>
            </div>
          ) : (
            <>
              {/* Mobile: карточки */}
              <div className="md:hidden divide-y divide-slate-100">
                {tripsWithExpenses.map((trip) => {
                  const tripProfit = (trip.revenue_eur || 0) - trip.expenses;
                  const clientName = pickName(trip.clients) || 'Не указан';
                  return (
                    <a
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
                            {clientName}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${statusColors[trip.status] || 'bg-slate-100 text-slate-700'}`}>
                          {statusLabels[trip.status] || trip.status}
                        </span>
                      </div>

                      {trip.route && (
                        <div className="flex items-start gap-1 text-xs text-slate-500 mb-2 break-words">
                          <RouteIcon className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" strokeWidth={2} />
                          <span>{trip.route}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Фрахт</div>
                          <div className="text-sm font-bold text-green-600 break-words tabular-nums">
                            {(trip.revenue_eur || 0).toFixed(0)} €
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
                    </a>
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
                    {tripsWithExpenses.map((trip) => {
                      const tripProfit = (trip.revenue_eur || 0) - trip.expenses;
                      const clientName = pickName(trip.clients) || 'Не указан';
                      return (
                        <tr key={trip.id} className="border-b border-slate-50 hover:bg-brand-50/30 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500 font-medium tabular-nums">
                            {trip.trip_number || '—'}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            <a href={`/trips/${trip.id}`} className="hover:text-brand-600 transition-colors">
                              {clientName}
                            </a>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {trip.route || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[trip.status] || 'bg-slate-100 text-slate-700'}`}>
                              {statusLabels[trip.status] || trip.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-green-600 whitespace-nowrap tabular-nums">
                            {(trip.revenue_eur || 0).toFixed(2)} €
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
