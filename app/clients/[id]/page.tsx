import { supabase } from '../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  if (!clientId) return <div className="p-8">Ошибка: ID клиента не передан</div>;

  const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single();
  if (error) return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;

  const { data: trips } = await supabase
    .from('trips')
    .select('*, drivers(first_name, last_name, phone), trucks(registration_number)')
    .eq('client_id', clientId)
    .order('trip_number', { ascending: false });

  // Загружаем прицепы (они в отдельной таблице trucks)
  const trailerIds = trips?.map((t) => t.trailer_id).filter(Boolean) || [];
  let trailersMap: Record<string, string> = {};
  if (trailerIds.length > 0) {
    const { data: trailerData } = await supabase
      .from('trucks')
      .select('id, registration_number')
      .in('id', trailerIds);
    trailerData?.forEach((t) => {
      trailersMap[t.id] = t.registration_number;
    });
  }

  const { data: expenses } = await supabase.from('trip_expenses').select('trip_id, amount_eur');

  const expensesByTrip = expenses?.reduce((acc, e) => {
    if (!e.trip_id) return acc;
    if (!acc[e.trip_id]) acc[e.trip_id] = 0;
    acc[e.trip_id] += e.amount_eur || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  const totalRevenue = trips?.reduce((sum, t) => sum + (t.revenue_eur || 0), 0) || 0;
  const totalExpenses = trips?.reduce((sum, t) => sum + (expensesByTrip[t.id] || 0), 0) || 0;
  const profit = totalRevenue - totalExpenses;

  const initials = client.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

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
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        <a href="/clients" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все клиенты
        </a>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-700 flex items-center justify-center text-white font-bold text-2xl shrink-0">
              {initials || '🤝'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                {client.contact_person && <span>👤 {client.contact_person}</span>}
                {client.phone && <span>📞 {client.phone}</span>}
                {client.email && <span>✉️ {client.email}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="text-sm font-medium text-slate-500 mb-2">Общий фрахт</div>
            <div className="text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="text-sm font-medium text-slate-500 mb-2">Общие расходы</div>
            <div className="text-2xl font-bold text-red-500">{totalExpenses.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="text-sm font-medium text-slate-500 mb-2">Прибыль</div>
            <div className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {profit.toFixed(2)} €
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Рейсы клиента ({trips?.length || 0})</h2>
          {trips?.length === 0 ? (
            <div className="text-slate-400 text-center py-8">У этого клиента ещё нет рейсов</div>
          ) : (
            <div className="space-y-3">
              {trips?.map((trip) => {
                const driver = trip.drivers;
                const truck = trip.trucks;
                const trailerNumber = trip.trailer_id ? trailersMap[trip.trailer_id] : null;

                return (
                  <a
                    key={trip.id}
                    href={`/trips/${trip.id}`}
                    className="block border border-slate-100 rounded-xl p-4
                               hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                          🚛
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate">
                            № {trip.trip_number || '—'} · {trip.route || '—'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                                          ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {statusLabels[trip.status] || trip.status}
                        </span>
                        <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                          {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Транспорт и водитель */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span>🚛</span>
                        <span>
                          {truck?.registration_number || '—'}
                          {trailerNumber && ` / ${trailerNumber}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <span>👤</span>
                        <span>{driver ? `${driver.first_name} ${driver.last_name}` : '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <span>📞</span>
                        <span>{driver?.phone || '—'}</span>
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
