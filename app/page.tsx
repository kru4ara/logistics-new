import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase-server';

export const dynamic = 'force-dynamic';

// Supabase может вернуть related-запись как объект ИЛИ как массив,
// в зависимости от того, как распознана связь. Нормализуем.
function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

export default async function Home() {
  const role = cookies().get('role')?.value;
  const userName = cookies().get('user_name')?.value
    ? decodeURIComponent(cookies().get('user_name')!.value)
    : 'Офис';

  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();

  // ============================================================
  // РЕЙСЫ
  // ============================================================
  const { data: trips } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .order('trip_number', { ascending: false });

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
  // ЭКСПЕДИРОВАНИЕ
  // ============================================================
  const { data: forwarding } = await supabase
    .from('forwarding_orders')
    .select('id, client_price_eur, contractor_price_eur, load_date, status, clients(name), contractors(name)')
    .order('load_date', { ascending: false });

  // Рейсы — общие
  const totalTripRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalTripExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const tripProfitTotal = totalTripRevenue - totalTripExpenses;

  // Экспедиции — общие
  const totalForwardingClient = forwarding?.reduce((sum, f) => sum + (f.client_price_eur || 0), 0) || 0;
  const totalForwardingContractor = forwarding?.reduce((sum, f) => sum + (f.contractor_price_eur || 0), 0) || 0;
  const forwardingMarginTotal = totalForwardingClient - totalForwardingContractor;

  // Общие комбинированные
  const combinedIncome = totalTripRevenue + totalForwardingClient;
  const combinedExpenses = totalTripExpenses + totalForwardingContractor;
  const combinedProfit = combinedIncome - combinedExpenses;

  // Текущий месяц
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  // Рейсы этого месяца
  const monthTrips = trips?.filter((t) => {
    if (!t.start_date) return false;
    const d = new Date(t.start_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthTripRevenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
  const monthTripExpenses = monthTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);

  // Экспедиции этого месяца
  const monthForwarding = forwarding?.filter((f) => {
    if (!f.load_date) return false;
    const d = new Date(f.load_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthForwardingClient = monthForwarding.reduce((sum, f) => sum + (f.client_price_eur || 0), 0);
  const monthForwardingContractor = monthForwarding.reduce((sum, f) => sum + (f.contractor_price_eur || 0), 0);

  // Общие за месяц
  const monthTotalIncome = monthTripRevenue + monthForwardingClient;
  const monthTotalExpenses = monthTripExpenses + monthForwardingContractor;
  const monthTotalProfit = monthTotalIncome - monthTotalExpenses;

  // Топ-5 клиентов (рейсы + экспедиции)
  const clientStats: Record<string, { name: string; revenue: number; count: number }> = {};
  trips?.forEach((t) => {
    const name = pickName(t.clients);
    if (!name) return;
    if (!clientStats[name]) clientStats[name] = { name, revenue: 0, count: 0 };
    clientStats[name].revenue += t.revenue_eur || 0;
    clientStats[name].count += 1;
  });
  forwarding?.forEach((f) => {
    const name = pickName(f.clients);
    if (!name) return;
    if (!clientStats[name]) clientStats[name] = { name, revenue: 0, count: 0 };
    clientStats[name].revenue += f.client_price_eur || 0;
    clientStats[name].count += 1;
  });
  const topClients = Object.values(clientStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Топ-5 маршрутов (только рейсы)
  const routeStats: Record<string, { route: string; revenue: number; count: number }> = {};
  trips?.forEach((t) => {
    if (!t.route) return;
    if (!routeStats[t.route]) routeStats[t.route] = { route: t.route, revenue: 0, count: 0 };
    routeStats[t.route].revenue += t.revenue_eur || 0;
    routeStats[t.route].count += 1;
  });
  const topRoutes = Object.values(routeStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* Приветствие */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Привет, {userName} 👋</h1>
          <p className="text-slate-500 mt-1">Обзор вашей логистики за {monthName}</p>
        </div>

        {/* КОМБИНИРОВАННЫЕ ПОКАЗАТЕЛИ ЗА МЕСЯЦ */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            📊 Показатели за {monthName}
          </h2>
          <div className="grid gap-5 md:grid-cols-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Сделок</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl">📊</div>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {monthTrips.length + monthForwarding.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                🚛 {monthTrips.length} · 📦 {monthForwarding.length}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Доход</span>
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-xl">💵</div>
              </div>
              <div className="text-2xl font-bold text-green-600">{monthTotalIncome.toFixed(0)} €</div>
              <div className="text-xs text-slate-400 mt-1">
                Фрахт: {monthTripRevenue.toFixed(0)} € · Эксп.: {monthForwardingClient.toFixed(0)} €
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Расходы</span>
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl">📉</div>
              </div>
              <div className="text-2xl font-bold text-red-500">{monthTotalExpenses.toFixed(0)} €</div>
              <div className="text-xs text-slate-400 mt-1">
                Рейсы: {monthTripExpenses.toFixed(0)} € · Подряд.: {monthForwardingContractor.toFixed(0)} €
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-500">Прибыль</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">📈</div>
              </div>
              <div className={`text-2xl font-bold ${monthTotalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {monthTotalProfit.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {/* ОБЩИЕ ПОКАЗАТЕЛИ ЗА ВСЁ ВРЕМЯ */}
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            🏆 За всё время
          </h2>
          <div className="grid gap-5 md:grid-cols-4">
            <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl shadow-lg p-6 text-white">
              <div className="text-sm text-green-100">Общий доход</div>
              <div className="text-3xl font-bold mt-2">{combinedIncome.toFixed(0)} €</div>
              <div className="text-xs text-green-200 mt-1">Рейсы + Экспедирование</div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-2xl shadow-lg p-6 text-white">
              <div className="text-sm text-red-100">Общие расходы</div>
              <div className="text-3xl font-bold mt-2">{combinedExpenses.toFixed(0)} €</div>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-lg p-6 text-white">
              <div className="text-sm text-purple-100">📦 Экспедирование</div>
              <div className="text-3xl font-bold mt-2">{forwardingMarginTotal.toFixed(0)} €</div>
              <div className="text-xs text-purple-200 mt-1">Маржа за всё время</div>
            </div>
            <div className={`bg-gradient-to-br ${combinedProfit >= 0 ? 'from-blue-600 to-blue-800' : 'from-red-600 to-red-800'} rounded-2xl shadow-lg p-6 text-white`}>
              <div className={`text-sm ${combinedProfit >= 0 ? 'text-blue-100' : 'text-red-100'}`}>Чистая прибыль</div>
              <div className="text-3xl font-bold mt-2">{combinedProfit.toFixed(0)} €</div>
              <div className="text-xs text-blue-200 mt-1">
                🚛 {tripProfitTotal.toFixed(0)} € + 📦 {forwardingMarginTotal.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {/* ПОСЛЕДНИЕ ЭКСПЕДИЦИИ */}
        {forwarding && forwarding.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-900">📦 Последние экспедиции</h2>
              <a href="/forwarding" className="text-sm text-blue-600 hover:underline font-medium">Все экспедиции →</a>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {forwarding.slice(0, 4).map((f) => {
                const margin = (f.client_price_eur || 0) - (f.contractor_price_eur || 0);
                const clientName = pickName(f.clients) || 'Не указан';
                const contractorName = pickName(f.contractors) || '—';
                return (
                  <a
                    key={f.id}
                    href={`/forwarding/${f.id}`}
                    className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                               hover:shadow-lg hover:border-purple-200 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-xs text-slate-400 font-medium">
                        {f.load_date ? new Date(f.load_date).toLocaleDateString('ru-RU') : '—'}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border
                                        ${statusColors[f.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {statusLabels[f.status] || f.status}
                      </span>
                    </div>
                    <div className="text-base font-bold text-slate-900 mb-1 truncate">
                      {clientName}
                    </div>
                    <div className="text-xs text-slate-500 truncate mb-3">
                      → {contractorName}
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">Маржа</span>
                      <span className={`text-sm font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {margin.toFixed(0)} €
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ТОП-5 КЛИЕНТОВ И ТОП-5 МАРШРУТОВ */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">🤝 Топ-5 клиентов</h2>
              <a href="/clients" className="text-sm text-blue-600 hover:underline font-medium">Все →</a>
            </div>
            {topClients.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">Пока нет данных</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topClients.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                       ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                         i === 1 ? 'bg-slate-200 text-slate-600' :
                                         i === 2 ? 'bg-orange-100 text-orange-700' :
                                         'bg-slate-100 text-slate-500'}`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{c.name}</div>
                        <div className="text-xs text-slate-400">{c.count} сделок</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-green-600">{c.revenue.toFixed(0)} €</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">🛣 Топ-5 маршрутов</h2>
              <a href="/routes" className="text-sm text-blue-600 hover:underline font-medium">Все →</a>
            </div>
            {topRoutes.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">Пока нет данных</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topRoutes.map((r, i) => (
                  <div key={r.route} className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                       ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                         i === 1 ? 'bg-slate-200 text-slate-600' :
                                         i === 2 ? 'bg-orange-100 text-orange-700' :
                                         'bg-slate-100 text-slate-500'}`}>
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{r.route}</div>
                        <div className="text-xs text-slate-400">{r.count} рейсов</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-green-600">{r.revenue.toFixed(0)} €</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ПОСЛЕДНИЕ РЕЙСЫ */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">🚛 Последние рейсы</h2>
            <a href="/trips" className="text-sm text-blue-600 hover:underline font-medium">Все рейсы →</a>
          </div>

          {trips?.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-slate-400">
              Рейсов пока нет
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {trips?.slice(0, 4).map((trip) => {
                const clientName = pickName(trip.clients) || 'Не указан';
                return (
                  <a
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm
                               hover:shadow-lg hover:border-blue-200 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="text-xs text-slate-400 font-medium">№ {trip.trip_number || '—'}</div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border
                                        ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {statusLabels[trip.status] || trip.status}
                      </span>
                    </div>
                    <div className="text-base font-bold text-slate-900 mb-2 truncate">
                      {clientName}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mb-3">
                      <span>🛣</span>
                      <span className="truncate">{trip.route || '—'}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">
                        {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                      </span>
                      <span className="text-sm font-bold text-green-600">
                        {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* БЫСТРЫЙ ДОСТУП */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">⚡ Быстрый доступ</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/trips/new" className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-600/20 transition-all">
              ➕ Создать рейс
            </a>
            <a href="/forwarding/new" className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-md shadow-purple-600/20 transition-all">
              📦 Новая экспедиция
            </a>
            <a href="/drivers" className="px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all">
              🚛 Водители
            </a>
            <a href="/trucks" className="px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all">
              🚚 Машины
            </a>
            <a href="/clients" className="px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all">
              🤝 Клиенты
            </a>
            <a href="/contractors" className="px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all">
              🏢 Подрядчики
            </a>
            <a href="/reminders" className="px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all">
              ⏰ Напоминания
            </a>
            <a href="/reports" className="px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all">
              💰 Отчёты
            </a>
            <a href="/fixed-costs" className="px-5 py-3 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 font-semibold rounded-xl transition-all">
              💶 Фикс. затраты
            </a>
          </div>
        </div>

      </div>
    </main>
  );
}
