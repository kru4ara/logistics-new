import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const role = cookies().get('role')?.value;
  const userName = cookies().get('user_name')?.value
    ? decodeURIComponent(cookies().get('user_name')!.value)
    : 'Офис';

  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const { data: trips } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .order('trip_number', { ascending: false })
    .limit(4);

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('amount_eur');

  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

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

  const quickActions = [
    { href: '/trips/new', label: 'Создать рейс', icon: '➕', color: 'from-blue-500 to-blue-700' },
    { href: '/trips', label: 'Рейсы', icon: '📋', color: 'from-slate-500 to-slate-700' },
    { href: '/drivers', label: 'Водители', icon: '🚛', color: 'from-indigo-500 to-indigo-700' },
    { href: '/trucks', label: 'Машины', icon: '🚚', color: 'from-purple-500 to-purple-700' },
    { href: '/clients', label: 'Клиенты', icon: '🤝', color: 'from-pink-500 to-pink-700' },
    { href: '/routes', label: 'Маршруты', icon: '🛣', color: 'from-amber-500 to-amber-700' },
    { href: '/reports', label: 'Отчёты', icon: '💰', color: 'from-green-500 to-green-700' },
    { href: '/reminders', label: 'Напоминания', icon: '⏰', color: 'from-red-500 to-red-700' },
    { href: '/map', label: 'Карта', icon: '🗺', color: 'from-cyan-500 to-cyan-700' },
    { href: '/fixed-costs', label: 'Фикс. затраты', icon: '💶', color: 'from-teal-500 to-teal-700' },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* Приветствие */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Привет, {userName} 👋</h1>
          <p className="text-slate-500 mt-1">Вот что происходит в вашей логистике сегодня</p>
        </div>

        {/* Карточки со статистикой */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Фрахт</span>
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">💵</div>
            </div>
            <div className="text-3xl font-bold text-green-600">{totalRevenue.toFixed(2)} €</div>
            <div className="text-xs text-slate-400 mt-1">за последние 4 рейса</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Расходы</span>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">📉</div>
            </div>
            <div className="text-3xl font-bold text-red-500">{totalExpenses.toFixed(2)} €</div>
            <div className="text-xs text-slate-400 mt-1">за последние 4 рейса</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">Чистая прибыль</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📈</div>
            </div>
            <div className={`text-3xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {profit.toFixed(2)} €
            </div>
            <div className="text-xs text-slate-400 mt-1">разница между фрахтом и расходами</div>
          </div>
        </div>

        {/* Быстрый доступ */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Быстрый доступ</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {quickActions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                           hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} 
                                 flex items-center justify-center text-2xl mb-3
                                 group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <div className="font-semibold text-slate-800 text-sm">{action.label}</div>
              </a>
            ))}
          </div>
        </div>

        {/* Последние рейсы */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900">Последние рейсы</h2>
            <a href="/trips" className="text-blue-600 text-sm font-medium hover:underline">
              Все рейсы →
            </a>
          </div>

          {trips?.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
              Рейсов пока нет
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {trips?.map((trip) => (
                <a
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                             hover:shadow-lg hover:border-blue-200 transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-xs text-slate-400 font-medium">№ {trip.trip_number || '—'}</div>
                      <div className="text-lg font-bold text-slate-900 mt-0.5">
                        {trip.clients?.name || 'Не указан'}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border
                                      ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {statusLabels[trip.status] || trip.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                    <span>🛣</span>
                    <span>{trip.route || '—'}</span>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                      {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
