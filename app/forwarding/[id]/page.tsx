import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import { deleteForwarding } from '../actions';
import ForwardingStatusButtons from './ForwardingStatusButtons';

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

export default async function ForwardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from('forwarding_orders')
    .select('*, clients(name, contact_person, phone), contractors(name, phone)')
    .eq('id', id)
    .single();

  if (error || !order) {
    return <div className="p-8 text-red-500">Заявка не найдена</div>;
  }

  const clientPrice = order.client_price_eur || 0;
  const contractorPrice = order.contractor_price_eur || 0;
  const margin = clientPrice - contractorPrice;
  const marginPct = clientPrice > 0 ? (margin / clientPrice) * 100 : 0;

  const originalCurrency = order.original_currency || 'EUR';
  const showOriginal = originalCurrency !== 'EUR';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-6 py-8 space-y-6">

        <a href="/forwarding" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все заявки
        </a>

        {/* Заголовок */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              📦 Заявка #{order.order_number || '—'}
            </h1>
            <p className="text-slate-500 mt-1">
              {order.load_date ? new Date(order.load_date).toLocaleDateString('ru-RU') : 'Дата не указана'}
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`/forwarding/${id}/edit`}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium
                         hover:bg-slate-100 transition-all text-sm"
            >
              ✏️ Редактировать
            </a>
            <form action={deleteForwarding.bind(null, id)}>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                           hover:bg-red-500 hover:text-white transition-all text-sm font-medium"
              >
                🗑️ Удалить
              </button>
            </form>
          </div>
        </div>

        {/* Статус */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Статус</div>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border
                ${statusColors[order.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {statusLabels[order.status] || order.status}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <ForwardingStatusButtons orderId={id} currentStatus={order.status} />
          </div>
        </div>

        {/* Экономика */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💰 Экономика</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
                Клиент платит
              </div>
              <div className="text-2xl font-bold text-green-600">{clientPrice.toFixed(2)} €</div>
              {showOriginal && (
                <div className="text-xs text-slate-400 mt-1">
                  ({order.original_client_price?.toFixed(2)} {originalCurrency})
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
                Подрядчику
              </div>
              <div className="text-2xl font-bold text-red-500">{contractorPrice.toFixed(2)} €</div>
              {showOriginal && (
                <div className="text-xs text-slate-400 mt-1">
                  ({order.original_contractor_price?.toFixed(2)} {originalCurrency})
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
                Наша маржа
              </div>
              <div className={`text-2xl font-bold ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {margin.toFixed(2)} €
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {marginPct.toFixed(1)}% от суммы клиента
              </div>
            </div>
          </div>
        </div>

        {/* Участники */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">🤝 Участники</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-l-4 border-green-500 pl-4 py-1">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Клиент (заказчик)
              </div>
              <div className="font-bold text-slate-900">{order.clients?.name || '—'}</div>
              {order.clients?.contact_person && (
                <div className="text-sm text-slate-600 mt-1">👤 {order.clients.contact_person}</div>
              )}
              {order.clients?.phone && (
                <div className="text-sm text-slate-600 mt-1">
                  📞 <a href={`tel:${order.clients.phone}`} className="hover:text-blue-600">{order.clients.phone}</a>
                </div>
              )}
            </div>
            <div className="border-l-4 border-red-500 pl-4 py-1">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                Подрядчик (перевозчик)
              </div>
              <div className="font-bold text-slate-900">{order.contractors?.name || '—'}</div>
              {order.contractors?.phone && (
                <div className="text-sm text-slate-600 mt-1">
                  📞 <a href={`tel:${order.contractors.phone}`} className="hover:text-blue-600">{order.contractors.phone}</a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Маршрут */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📍 Маршрут</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Откуда</div>
              <div className="text-slate-800 font-medium">{order.route_from || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Куда</div>
              <div className="text-slate-800 font-medium">{order.route_to || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Дата загрузки</div>
              <div className="text-slate-800 font-medium">
                {order.load_date ? new Date(order.load_date).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Дата выгрузки</div>
              <div className="text-slate-800 font-medium">
                {order.unload_date ? new Date(order.unload_date).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
            {order.cargo_description && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Груз</div>
                <div className="text-slate-800 font-medium">{order.cargo_description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Заметки */}
        {order.notes && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">📝 Заметки</h2>
            <div className="text-slate-700 whitespace-pre-wrap">{order.notes}</div>
          </div>
        )}

      </div>
    </main>
  );
}
