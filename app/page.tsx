import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../lib/supabase-server';

export const dynamic = 'force-dynamic';

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

const statusStripColors: Record<string, string> = {
  planned: 'bg-slate-300',
  active: 'bg-blue-500',
  completed: 'bg-green-500',
  invoiced: 'bg-yellow-500',
  paid: 'bg-emerald-500',
};

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

  const { data: tripExpenses } = await supabase
    .from('trip_expenses')
    .select('trip_id, amount_eur');

  const expensesByTrip = tripExpenses?.reduce((acc, e) => {
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
    .select('*, clients(name)')
    .order('load_date', { ascending: false });

  const forwardingIds = forwarding?.map((f) => f.id) || [];

  // Подрядчики экспедиций
  let contractorsByForwarding: Record<string, number> = {};
  if (forwardingIds.length > 0) {
    const { data: allContractors } = await supabase
      .from('forwarding_contractors')
      .select('forwarding_id, price_eur')
      .in('forwarding_id', forwardingIds);

    allContractors?.forEach((c) => {
      if (!c.forwarding_id) return;
      contractorsByForwarding[c.forwarding_id] =
        (contractorsByForwarding[c.forwarding_id] || 0) + (c.price_eur || 0);
    });
  }

  // Доп. расходы экспедиций
  let expensesByForwarding: Record<string, number> = {};
  if (forwardingIds.length > 0) {
    const { data: allFExp } = await supabase
      .from('forwarding_expenses')
      .select('forwarding_id, amount_eur')
      .in('forwarding_id', forwardingIds);

    allFExp?.forEach((e) => {
      if (!e.forwarding_id) return;
      expensesByForwarding[e.forwarding_id] =
        (expensesByForwarding[e.forwarding_id] || 0) + (e.amount_eur || 0);
    });
  }

  // ============================================================
  // ОБЩИЕ ИТОГИ
  // ============================================================
  const totalTripRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalTripExpenses = tripExpenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const tripProfitTotal = totalTripRevenue - totalTripExpenses;

  const totalForwardingClient = forwarding?.reduce((sum, f) => sum + (f.client_price_eur || 0), 0) || 0;
  const totalForwardingContractor = Object.values(contractorsByForwarding).reduce((s, v) => s + v, 0);
  const totalForwardingExpenses = Object.values(expensesByForwarding).reduce((s, v) => s + v, 0);
  const forwardingMarginTotal = totalForwardingClient - totalForwardingContractor - totalForwardingExpenses;

  const combinedIncome = totalTripRevenue + totalForwardingClient;
  const combinedExpenses = totalTripExpenses + totalForwardingContractor + totalForwardingExpenses;
  const combinedProfit = combinedIncome - combinedExpenses;

  // ============================================================
  // ТЕКУЩИЙ МЕСЯЦ
  // ============================================================
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const monthTrips = trips?.filter((t) => {
    if (!t.start_date) return false;
    const d = new Date(t.start_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthTripRevenue = monthTrips.reduce((sum, t) => sum + (t.revenue_eur || 0), 0);
  const monthTripExpenses = monthTrips.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0);

  const monthForwarding = forwarding?.filter((f) => {
    if (!f.load_date) return false;
    const d = new Date(f.load_date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthForwardingClient = monthForwarding.reduce((sum, f) => sum + (f.client_price_eur || 0), 0);
  const monthForwardingContractor = monthForwarding.reduce(
    (sum, f) => sum + (contractorsByForwarding[f.id] || 0),
    0
  );
  const monthForwardingExpenses = monthForwarding.reduce(
    (sum, f) => sum + (expensesByForwarding[f.id] || 0),
    0
  );

  const monthTotalIncome = monthTripRevenue + monthForwardingClient;
  const monthTotalExpenses = monthTripExpenses + monthForwardingContractor + monthForwardingExpenses;
  const monthTotalProfit = monthTotalIncome - monthTotalExpenses;

  // ============================================================
  // ТОП-5 клиентов
  // ============================================================
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

  // ============================================================
  // ТОП-5 маршрутов
  // ============================================================
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
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">

        {/* Приветствие */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 break-words">Привет, {userName} 👋</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Обзор вашей логистики за {monthName}</p>
        </div>

        {/* ПОКАЗАТЕЛИ ЗА МЕСЯЦ */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            📊 Показатели за {monthName}
          </h2>
          <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Сделок</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-blue-50 flex items-center justify-center text-base md:text-xl">📊</div>
              </div>
              <div className="text-2xl md:text-3xl font-bold text-blue-600">
                {monthTrips.length + monthForwarding.length}
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1">
                🚛 {monthTrips.length} · 📦 {monthForwarding.length}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Доход</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-50 flex items-center justify-center text-base md:text-xl">💵</div>
              </div>
              <div className="text-xl md:text-2xl font-bold text-green-600 break-words">{monthTotalIncome.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Фрахт: {monthTripRevenue.toFixed(0)} · Эксп.: {monthForwardingClient.toFixed(0)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Расходы</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-50 flex items-center justify-center text-base md:text-xl">📉</div>
              </div>
              <div className="text-xl md:text-2xl font-bold text-red-500 break-words">{monthTotalExpenses.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 break-words">
                Рейсы: {monthTripExpenses.toFixed(0)} · Эксп.: {(monthForwardingContractor + monthForwardingExpenses).toFixed(0)}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <span className="text-xs md:text-sm font-medium text-slate-500">Прибыль</span>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-base md:text-xl">📈</div>
              </div>
              <div className={`text-xl md:text-2xl font-bold break-words ${monthTotalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {monthTotalProfit.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {/* ОБЩИЕ ЗА ВСЁ ВРЕМЯ */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3">
            🏆 За всё время
          </h2>
          <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-4">
            <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl shadow-lg p-4 md:p-6 text-white">
              <div className="text-xs md:text-sm text-green-100">Общий доход</div>
              <div className="text-xl md:text-3xl font-bold mt-2 break-words">{combinedIncome.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-green-200 mt-1">Рейсы + Экспедирование</div>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-700 rounded-2xl shadow-lg p-4 md:p-6 text-white">
              <div className="text-xs md:text-sm text-red-100">Общие расходы</div>
              <div className="text-xl md:text-3xl font-bold mt-2 break-words">{combinedExpenses.toFixed(0)} €</div>
            </div>
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-lg p-4 md:p-6 text-white">
              <div className="text-xs md:text-sm text-purple-100">📦 Экспедирование</div>
              <div className="text-xl md:text-3xl font-bold mt-2 break-words">{forwardingMarginTotal.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-purple-200 mt-1">Маржа за всё время</div>
            </div>
            <div className={`bg-gradient-to-br ${combinedProfit >= 0 ? 'from-blue-600 to-blue-800' : 'from-red-600 to-red-800'} rounded-2xl shadow-lg p-4 md:p-6 text-white`}>
              <div className={`text-xs md:text-sm ${combinedProfit >= 0 ? 'text-blue-100' : 'text-red-100'}`}>Чистая прибыль</div>
              <div className="text-xl md:text-3xl font-bold mt-2 break-words">{combinedProfit.toFixed(0)} €</div>
              <div className="text-[10px] md:text-xs text-blue-200 mt-1 break-words">
                🚛 {tripProfitTotal.toFixed(0)} € + 📦 {forwardingMarginTotal.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {/* ТОП-5 КЛИЕНТОВ И МАРШРУТОВ */}
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base md:text-lg font-bold text-slate-900">🤝 Топ-5 клиентов</h2>
              <a href="/clients" className="text-sm text-blue-600 hover:underline font-medium whitespace-nowrap">
                Все →
              </a>
            </div>
            {topClients.length === 0 ? (
              <div className="p-8 md:p-10 text-center text-slate-400 text-sm">Пока нет данных</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topClients.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3 px-4 md:px-5 py-3 md:py-4">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold shrink-0
                                     ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                       i === 1 ? 'bg-slate-200 text-slate-600' :
                                       i === 2 ? 'bg-orange-100 text-orange-700' :
                                       'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 break-words text-sm md:text-base">
                        {c.name}
                      </div>
                      <div className="text-xs text-slate-400">{c.count} сделок</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-green-600 text-sm md:text-base whitespace-nowrap">
                        {c.revenue.toFixed(0)} €
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-base md:text-lg font-bold text-slate-900">🛣 Топ-5 маршрутов</h2>
              <a href="/routes" className="text-sm text-blue-600 hover:underline font-medium whitespace-nowrap">
                Все →
              </a>
            </div>
            {topRoutes.length === 0 ? (
              <div className="p-8 md:p-10 text-center text-slate-400 text-sm">Пока нет данных</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {topRoutes.map((r, i) => (
                  <div key={r.route} className="flex items-start gap-3 px-4 md:px-5 py-3 md:py-4">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold shrink-0
                                     ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                                       i === 1 ? 'bg-slate-200 text-slate-600' :
                                       i === 2 ? 'bg-orange-100 text-orange-700' :
                                       'bg-slate-100 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 text-sm md:text-base break-words leading-snug">
                        {r.route}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.count} рейсов</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-green-600 text-sm md:text-base whitespace-nowrap">
                        {r.revenue.toFixed(0)} €
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ПОСЛЕДНИЕ ЭКСПЕДИЦИИ — в стиле рейсов */}
        {forwarding && forwarding.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3 md:mb-4">
              <h2 className="text-base md:text-lg font-bold text-slate-900">📦 Последние экспедиции</h2>
              <a href="/forwarding" className="text-sm text-blue-600 hover:underline font-medium whitespace-nowrap">
                Все →
              </a>
            </div>
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {forwarding.slice(0, 4).map((f) => {
                const cSum = contractorsByForwarding[f.id] || 0;
                const eSum = expensesByForwarding[f.id] || 0;
                const margin = (f.client_price_eur || 0) - cSum - eSum;
                const clientName = pickName(f.clients) || 'Не указан';

                return (
                  <a
                    key={f.id}
                    href={`/forwarding/${f.id}`}
                    className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                               hover:shadow-xl hover:border-blue-200 transition-all duration-200 overflow-hidden active:scale-[0.99]"
                  >
                    <div className={`h-1.5 ${statusStripColors[f.status] || 'bg-slate-300'}`} />
                    <div className="p-4 md:p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-400 font-medium">
                            № {f.order_number || '—'}
                          </div>
                          <div className="text-base font-bold text-slate-900 mt-0.5 break-words group-hover:text-blue-600 transition-colors">
                            {clientName}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap
                                          ${statusColors[f.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {statusLabels[f.status] || f.status}
                        </span>
                      </div>

                      {f.client_request_number && (
                        <div className="text-xs text-slate-500 mb-2 break-words">
                          📄 Заявка: <b className="text-slate-700">{f.client_request_number}</b>
                        </div>
                      )}

                      <div className="flex items-start gap-1 text-xs text-slate-500 mb-3">
                        <span className="shrink-0">🛣</span>
                        <span className="break-words">
                          {f.route_from || f.route_to
                            ? `${f.route_from || '?'} → ${f.route_to || '?'}`
                            : '—'}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">
                          {f.load_date ? new Date(f.load_date).toLocaleDateString('ru-RU') : '—'}
                        </span>
                        <span className={`text-sm font-bold whitespace-nowrap ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {margin.toFixed(0)} €
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ПОСЛЕДНИЕ РЕЙСЫ */}
        <div>
          <div className="flex justify-between items-center mb-3 md:mb-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900">🚛 Последние рейсы</h2>
            <a href="/trips" className="text-sm text-blue-600 hover:underline font-medium whitespace-nowrap">
              Все →
            </a>
          </div>

          {trips?.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 md:p-10 text-center text-slate-400">
              Рейсов пока нет
            </div>
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {trips?.slice(0, 4).map((trip) => {
                const clientName = pickName(trip.clients) || 'Не указан';
                return (
                  <a
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                               hover:shadow-xl hover:border-blue-200 transition-all duration-200 overflow-hidden active:scale-[0.99]"
                  >
                    <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />
                    <div className="p-4 md:p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-slate-400 font-medium">№ {trip.trip_number || '—'}</div>
                          <div className="text-base font-bold text-slate-900 mt-0.5 break-words group-hover:text-blue-600 transition-colors">
                            {clientName}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap
                                          ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {statusLabels[trip.status] || trip.status}
                        </span>
                      </div>

                      <div className="flex items-start gap-1 text-xs text-slate-500 mb-3">
                        <span className="shrink-0">🛣</span>
                        <span className="break-words">{trip.route || '—'}</span>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">
                          {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                        </span>
                        <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                          {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
