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
  const month = parseInt(searchParams.month || '') || 0;

  let query = supabase
    .from('forwarding_orders')
    .select('*, clients(name)')
    .order('load_date', { ascending: false });

  if (month > 0) {
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
    query = query.gte('load_date', firstDay).lte('load_date', lastDay);
  } else {
    const firstDay = `${year}-01-01`;
    const lastDay = `${year}-12-31`;
    query = query.gte('load_date', firstDay).lte('load_date', lastDay);
  }

  const { data: orders, error } = await query;

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  const orderIds = orders?.map((o) => o.id) || [];

  // Сумма подрядчиков по каждой заявке (из новой таблицы)
  let contractorsByOrder: Record<string, number> = {};
  // Список имён подрядчиков по заявке (для показа)
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

  // Сумма расходов по заявкам
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

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📦 Экспедирование</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Перепродажа грузов: клиент → подрядчики</p>
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
                  href={`/forwarding?year=${y}&month=${month}`}
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
                href={`/forwarding?year=${year}&month=0`}
                className={`px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${month === 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                Все
              </a>
              {monthNames.map((name, i) => {
                const m = i + 1;
                const isActive = month === m;
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
        </div>

        {/* Итоги */}
        <div className="grid gap-3 md:gap-5 grid-cols-2 md:grid-cols-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Доход от клиентов
            </div>
            <div className="text-lg md:text-2xl font-bold text-green-600 break-words">{totalClient.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Подрядчикам
            </div>
            <div className="text-lg md:text-2xl font-bold text-red-500 break-words">{totalContractor.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Доп. расходы
            </div>
            <div className="text-lg md:text-2xl font-bold text-orange-600 break-words">{totalExpenses.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Наша маржа
            </div>
            <div className={`text-lg md:text-2xl font-bold break-words ${totalMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalMargin.toFixed(2)} €
            </div>
          </div>
        </div>

        {/* Список */}
        {(!orders || orders.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 md:p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-slate-500 mb-4">За этот период заявок нет</p>
            <a
              href="/forwarding/new"
              className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all"
            >
              Создать первую
            </a>
          </div>
        ) : (
          <>
            {/* Mobile: карточки */}
            <div className="md:hidden space-y-3">
              {orders.map((o) => {
                const cSum = contractorsByOrder[o.id] || 0;
                const expSum = expensesByOrder[o.id] || 0;
                const margin = (o.client_price_eur || 0) - cSum - expSum;
                const clientName = pickName(o.clients) || '—';
                const cNames = contractorNamesByOrder[o.id] || [];
                const contractorsCount = cNames.length;

                return (
                  <a
                    key={o.id}
                    href={`/forwarding/${o.id}`}
                    className="block bg-white rounded-2xl border border-slate-100 shadow-sm
                               hover:shadow-lg hover:border-blue-200 transition-all active:scale-[0.99] overflow-hidden"
                  >
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="text-sm font-bold text-blue-600">
                          #{o.order_number || '—'}
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap
                                          ${statusColors[o.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {statusLabels[o.status] || o.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        📅 {o.load_date ? new Date(o.load_date).toLocaleDateString('ru-RU') : '—'}
                      </div>
                      {o.client_request_number && (
                        <div className="text-xs text-slate-500 mt-1 break-words">
                          📄 Заявка клиента: <b className="text-slate-700">{o.client_request_number}</b>
                          {o.client_request_date && (
                            <span className="text-slate-400 ml-1">
                              от {new Date(o.client_request_date).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">🤝</span>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Клиент</div>
                          <div className="text-sm font-semibold text-slate-800 break-words">{clientName}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">🚛</span>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                            Подрядчики {contractorsCount > 0 && `(${contractorsCount})`}
                          </div>
                          <div className="text-sm text-slate-700 break-words">
                            {contractorsCount === 0
                              ? '—'
                              : contractorsCount === 1
                                ? cNames[0]
                                : cNames.join(' · ')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">🛣</span>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Маршрут</div>
                          <div className="text-sm text-slate-700 break-words">
                            {o.route_from || o.route_to
                              ? `${o.route_from || '?'} → ${o.route_to || '?'}`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50/40">
                      <div className={`grid ${expSum > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2 text-xs`}>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Клиент</div>
                          <div className="text-sm font-bold text-green-600 break-words">
                            {(o.client_price_eur || 0).toFixed(0)} €
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Подряд.</div>
                          <div className="text-sm font-bold text-red-500 break-words">
                            {cSum > 0 ? `−${cSum.toFixed(0)} €` : '—'}
                          </div>
                        </div>
                        {expSum > 0 && (
                          <div>
                            <div className="text-[10px] uppercase text-slate-400 font-medium">Расх.</div>
                            <div className="text-sm font-bold text-orange-600 break-words">
                              −{expSum.toFixed(0)} €
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] uppercase text-slate-400 font-medium">Маржа</div>
                          <div className={`text-sm font-bold break-words ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {margin.toFixed(0)} €
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Desktop: таблица */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">№</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Дата</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Клиент</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Заявка</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Подрядчики</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Маршрут</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Клиент €</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Подряд. €</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Расходы</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Маржа</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const cSum = contractorsByOrder[o.id] || 0;
                      const expSum = expensesByOrder[o.id] || 0;
                      const margin = (o.client_price_eur || 0) - cSum - expSum;
                      const clientName = pickName(o.clients) || '—';
                      const cNames = contractorNamesByOrder[o.id] || [];
                      const contractorsDisplay =
                        cNames.length === 0
                          ? '—'
                          : cNames.length === 1
                            ? cNames[0]
                            : `${cNames[0]} +${cNames.length - 1}`;

                      return (
                        <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-4">
                            <a href={`/forwarding/${o.id}`} className="font-semibold text-blue-600 hover:underline">
                              #{o.order_number || '—'}
                            </a>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                            {o.load_date ? new Date(o.load_date).toLocaleDateString('ru-RU') : '—'}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-800 font-medium">{clientName}</td>
                          <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                            {o.client_request_number ? (
                              <span>
                                <b className="text-slate-800">{o.client_request_number}</b>
                                {o.client_request_date && (
                                  <span className="text-slate-400 ml-1 text-xs">
                                    от {new Date(o.client_request_date).toLocaleDateString('ru-RU')}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate" title={cNames.join(', ')}>
                            {contractorsDisplay}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600 max-w-[200px] truncate">
                            {o.route_from || o.route_to
                              ? `${o.route_from || '?'} → ${o.route_to || '?'}`
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-green-600 whitespace-nowrap">
                            {(o.client_price_eur || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-red-500 whitespace-nowrap">
                            {cSum > 0 ? `−${cSum.toFixed(2)}` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-orange-600 whitespace-nowrap">
                            {expSum > 0 ? `−${expSum.toFixed(2)}` : '—'}
                          </td>
                          <td className={`py-3 px-4 text-right text-sm font-bold whitespace-nowrap ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {margin.toFixed(2)} €
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                              ${statusColors[o.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {statusLabels[o.status] || o.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
