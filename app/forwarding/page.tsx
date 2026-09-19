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

export default async function ForwardingPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const year = parseInt(searchParams.year || '') || currentYear;
  const month = parseInt(searchParams.month || '') || 0; // 0 = весь год

  // Базовый запрос
  let query = supabase
    .from('forwarding_orders')
    .select('*, clients(name), contractors(name)')
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

  const totalClient = orders?.reduce((sum, o) => sum + (o.client_price_eur || 0), 0) || 0;
  const totalContractor = orders?.reduce((sum, o) => sum + (o.contractor_price_eur || 0), 0) || 0;
  const totalMargin = totalClient - totalContractor;

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];

  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📦 Экспедирование</h1>
            <p className="text-slate-500 mt-1">Перепродажа грузов: клиент → подрядчик</p>
          </div>
          <a
            href="/forwarding/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98]"
          >
            <span>➕</span>
            <span>Новая заявка</span>
          </a>
        </div>

        {/* Фильтры */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Период:</span>

          <div className="flex gap-2 flex-wrap">
            <a
              href={`/forwarding?year=${year}&month=0`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${month === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Весь {year}
            </a>
            {monthNames.map((name, i) => {
              const m = i + 1;
              const isActive = month === m;
              return (
                <a
                  key={m}
                  href={`/forwarding?year=${year}&month=${m}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {name}
                </a>
              );
            })}
          </div>

          <div className="flex gap-2 ml-auto">
            {years.map((y) => (
              <a
                key={y}
                href={`/forwarding?year=${y}&month=${month}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${year === y ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {y}
              </a>
            ))}
          </div>
        </div>

        {/* Итоги */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Доход от клиентов
            </div>
            <div className="text-2xl font-bold text-green-600">{totalClient.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Оплата подрядчикам
            </div>
            <div className="text-2xl font-bold text-red-500">{totalContractor.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Наша маржа
            </div>
            <div className={`text-2xl font-bold ${totalMargin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalMargin.toFixed(2)} €
            </div>
          </div>
        </div>

        {/* Список */}
        {(!orders || orders.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">№</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Дата</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Клиент</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Подрядчик</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Маршрут</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Клиент €</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Подрядчик €</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Маржа</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Статус</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const margin = (o.client_price_eur || 0) - (o.contractor_price_eur || 0);
                  return (
                    <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                      <td className="py-3 px-4">
                        <a href={`/forwarding/${o.id}`} className="font-semibold text-blue-600 hover:underline">
                          #{o.order_number || '—'}
                        </a>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {o.load_date ? new Date(o.load_date).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-800 font-medium">
                        {o.clients?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {o.contractors?.name || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 max-w-[250px] truncate">
                        {o.route_from || o.route_to
                          ? `${o.route_from || '?'} → ${o.route_to || '?'}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-green-600">
                        {(o.client_price_eur || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium text-red-500">
                        {(o.contractor_price_eur || 0).toFixed(2)}
                      </td>
                      <td className={`py-3 px-4 text-right text-sm font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {margin.toFixed(2)} €
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border
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
        )}

      </div>
    </main>
  );
}
