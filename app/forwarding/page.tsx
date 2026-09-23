import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершена',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачена',
};

const statusColors: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const statusStripColors: Record<string, string> = {
  planned: 'bg-slate-300',
  active: 'bg-blue-500',
  completed: 'bg-green-500',
  invoiced: 'bg-yellow-500',
  paid: 'bg-emerald-500',
};

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

export default async function ForwardingPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const currentYear = new Date().getFullYear();

  const year = parseInt(searchParams.year || '') || currentYear;
  const monthFilter = searchParams.month ? parseInt(searchParams.month) : null;

  let query = supabase
    .from('forwarding_orders')
    .select('*, clients(name)')
    .order('load_date', { ascending: false });

  if (monthFilter) {
    const firstDay = `${year}-${String(monthFilter).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthFilter, 0).toISOString().split('T')[0];
    query = query.gte('load_date', firstDay).lte('load_date', lastDay);
  } else {
    query = query.gte('load_date', `${year}-01-01`).lte('load_date', `${year}-12-31`);
  }

  const { data: orders, error } = await query;

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  const orderIds = orders?.map((o) => o.id) || [];

  // Подрядчики по заявкам
  let contractorsByOrder: Record<string, number> = {};
  let contractorNamesByOrder: Record<string, string[]> = {};

  if (orderIds.length > 0) {
    const { data: allContractors } = await supabase
      .from('forwarding_contractors')
      .select('forwarding_id, price_eur, contractors(name)')
      .in('forwarding_id', orderIds);

    allContractors?.forEach((c) => {
      if (!c.forwarding_id) return;
      contractorsByOrder[c.forwarding_id] =
        (contractorsByOrder[c.forwarding_id] || 0) + (c.price_eur || 0);

      const cName = pickName(c.contractors);
      if (cName) {
        if (!contractorNamesByOrder[c.forwarding_id]) contractorNamesByOrder[c.forwarding_id] = [];
        contractorNamesByOrder[c.forwarding_id].push(cName);
      }
    });
  }

  // Доп. расходы по заявкам
  let expensesByOrder: Record<string, number> = {};
  if (orderIds.length > 0) {
    const { data: allExp } = await supabase
      .from('forwarding_expenses')
      .select('forwarding_id, amount_eur')
      .in('forwarding_id', orderIds);

    allExp?.forEach((e) => {
      if (!e.forwarding_id) return;
      expensesByOrder[e.forwarding_id] = (expensesByOrder[e.forwarding_id] || 0) + (e.amount_eur || 0);
    });
  }

  const totalClient = orders?.reduce((sum, o) => sum + (o.client_price_eur || 0), 0) || 0;
  const totalContractor = Object.values(contractorsByOrder).reduce((s, v) => s + v, 0);
  const totalExpenses = Object.values(expensesByOrder).reduce((s, v) => s + v, 0);
  const totalMargin = totalClient - totalContractor - totalExpenses;

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  // Список годов
  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Группировка по месяцам загрузки
  const ordersByMonth: Record<string, { month: number; orders: any[] }> = {};
  orders?.forEach((o) => {
    if (!o.load_date) return;
    const d = new Date(o.load_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!ordersByMonth[key]) ordersByMonth[key] = { month: d.getMonth() + 1, orders: [] };
    ordersByMonth[key].orders.push(o);
  });

  const sortedMonthKeys = Object.keys(ordersByMonth).sort().reverse();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📦 Экспедирование</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Заявок: <b>{orders?.length || 0}</b>
            </p>
          </div>
          <a
            href="/forwarding/new"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-4 md:px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98] text-sm md:text-base"
          >
            <span>➕</span>
            <span>Новая заявка</span>
          </a>
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Год</div>
            <div className="flex flex-wrap gap-2">
              {years.map((y) => (
                <a
                  key={y}
                  href={`/forwarding?year=${y}${monthFilter ? `&month=${monthFilter}` : ''}`}
                  className={`px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all
                    ${year === y
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {y}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">Месяц</div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              <a
                href={`/forwarding?year=${year}`}
                className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${!monthFilter
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Все
              </a>
              {monthNames.map((name, i) => {
                const m = i + 1;
                const isActive = monthFilter === m;
                return (
                  <a
                    key={m}
                    href={`/forwarding?year=${year}&month=${m}`}
                    className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {name.slice(0, 3)}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Итоги по фильтру */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <div className="text-xs text-slate-400 font-medium">Доход от клиентов</div>
              <div className="text-base md:text-lg font-bold text-green-600 break-words">{totalClient.toFixed(0)} €</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Подрядчикам</div>
              <div className="text-base md:text-lg font-bold text-red-500 break-words">{totalContractor.toFixed(0)} €</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Доп. расходы</div>
              <div className="text-base md:text-lg font-bold text-orange-600 break-words">{totalExpenses.toFixed(0)} €</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Наша маржа</div>
              <div className={`text-base md:text-lg font-bold break-words ${totalMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {totalMargin.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>

        {/* Список по месяцам */}
        {(!orders || orders.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 md:p-16 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Заявок не найдено</h2>
            <p className="text-slate-500 mb-6">
              {monthFilter ? `За ${monthNames[monthFilter - 1]} ${year} нет заявок` : `За ${year} год нет заявок`}
            </p>
            <a
              href="/forwarding/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                         font-semibold px-6 py-3 rounded-xl transition-all"
            >
              ➕ Создать заявку
            </a>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
            {sortedMonthKeys.map((key) => {
              const group = ordersByMonth[key];
              const monthOrders = group.orders;

              const mClient = monthOrders.reduce((sum, o) => sum + (o.client_price_eur || 0), 0);
              const mContractor = monthOrders.reduce((sum, o) => sum + (contractorsByOrder[o.id] || 0), 0);
              const mExpenses = monthOrders.reduce((sum, o) => sum + (expensesByOrder[o.id] || 0), 0);
              const mMargin = mClient - mContractor - mExpenses;

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
                          Заявок: {monthOrders.length}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-right">
                      <div>
                        <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Доход</div>
                        <div className="text-sm md:text-base font-bold text-green-600">{mClient.toFixed(0)} €</div>
                      </div>
                      <div>
                        <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Расходы</div>
                        <div className="text-sm md:text-base font-bold text-red-500">{(mContractor + mExpenses).toFixed(0)} €</div>
                      </div>
                      <div>
                        <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Маржа</div>
                        <div className={`text-sm md:text-base font-bold ${mMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {mMargin.toFixed(0)} €
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Карточки */}
                  <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {monthOrders.map((o) => {
                      const cSum = contractorsByOrder[o.id] || 0;
                      const eSum = expensesByOrder[o.id] || 0;
                      const margin = (o.client_price_eur || 0) - cSum - eSum;
                      const clientName = pickName(o.clients) || 'Не указан';
                      const cNames = contractorNamesByOrder[o.id] || [];
                      const contractorsDisplay =
                        cNames.length === 0
                          ? '—'
                          : cNames.length === 1
                            ? cNames[0]
                            : `${cNames[0]} +${cNames.length - 1}`;

                      return (
                        <a
                          key={o.id}
                          href={`/forwarding/${o.id}`}
                          className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                                     hover:shadow-xl hover:border-blue-200 md:hover:-translate-y-0.5
                                     transition-all duration-200 overflow-hidden active:scale-[0.99]"
                        >
                          <div className={`h-1.5 ${statusStripColors[o.status] || 'bg-slate-300'}`} />

                          <div className="p-4 md:p-5">
                            {/* № + статус */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-xs text-slate-400 font-medium">
                                  № {o.order_number || '—'}
                                </div>
                                <div className="text-base md:text-lg font-bold text-slate-900 mt-0.5 group-hover:text-blue-600 transition-colors break-words">
                                  {clientName}
                                </div>
                              </div>
                              <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap
                                                ${statusColors[o.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {statusLabels[o.status] || o.status}
                              </span>
                            </div>

                            {/* Заявка клиента */}
                            {o.client_request_number && (
                              <div className="text-xs text-slate-500 mb-2 break-words">
                                📄 Заявка: <b className="text-slate-700">{o.client_request_number}</b>
                                {o.client_request_date && (
                                  <span className="text-slate-400 ml-1">
                                    от {new Date(o.client_request_date).toLocaleDateString('ru-RU')}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Маршрут */}
                            <div className="flex items-start gap-2 text-sm text-slate-600 mb-2">
                              <span className="shrink-0">🛣</span>
                              <span className="break-words">
                                {o.route_from || o.route_to
                                  ? `${o.route_from || '?'} → ${o.route_to || '?'}`
                                  : '—'}
                              </span>
                            </div>

                            {/* Дата + подрядчики */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-4">
                              <span>
                                📅 {o.load_date ? new Date(o.load_date).toLocaleDateString('ru-RU') : '—'}
                              </span>
                              {cNames.length > 0 && (
                                <span className="truncate max-w-[60%]" title={cNames.join(', ')}>
                                  🚛 {contractorsDisplay}
                                </span>
                              )}
                            </div>

                            {/* Экономика */}
                            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Клиент</div>
                                <div className="text-sm font-bold text-green-600 break-words">
                                  {(o.client_price_eur || 0).toFixed(0)} €
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Подряд.</div>
                                <div className="text-sm font-bold text-red-500 break-words">
                                  {cSum > 0 ? `−${cSum.toFixed(0)} €` : '—'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Маржа</div>
                                <div className={`text-sm font-bold break-words ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {margin.toFixed(0)} €
                                </div>
                              </div>
                            </div>

                            {/* Доп. расходы (если есть) */}
                            {eSum > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-orange-600 font-medium">
                                Доп. расходы: −{eSum.toFixed(0)} €
                              </div>
                            )}
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
