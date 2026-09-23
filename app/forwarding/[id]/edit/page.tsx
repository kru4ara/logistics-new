import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';
import { updateForwarding } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditForwardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from('forwarding_orders')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !order) {
    return <div className="p-8 text-red-500">Заявка не найдена</div>;
  }

  const { data: clients } = await supabase.from('clients').select('id, name').order('name');
  const { data: contractors } = await supabase.from('contractors').select('id, name').order('name');

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2 flex items-center gap-2';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href={`/forwarding/${id}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к заявке
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            ✏️ Редактировать заявку #{order.order_number || '—'}
          </h1>
        </div>

        <form action={updateForwarding.bind(null, id)} className="space-y-4 md:space-y-6">

          {/* УЧАСТНИКИ */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🤝 Участники</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>Клиент (заказчик)</label>
                <select name="client_id" defaultValue={order.client_id || ''} className={inputClass}>
                  <option value="">Выберите клиента...</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Подрядчик (перевозчик)</label>
                <select name="contractor_id" defaultValue={order.contractor_id || ''} className={inputClass}>
                  <option value="">Выберите подрядчика...</option>
                  {contractors?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ЗАЯВКА КЛИЕНТА */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📄 Заявка клиента</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>Номер заявки</label>
                <input
                  type="text"
                  name="client_request_number"
                  defaultValue={order.client_request_number || ''}
                  placeholder="ZAM-2026-001"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Дата заявки</label>
                <input
                  type="date"
                  name="client_request_date"
                  defaultValue={order.client_request_date || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ЭКОНОМИКА */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>💰 Экономика</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-3">
              <div>
                <label className={labelClass}>Валюта</label>
                <select name="currency" className={inputClass} defaultValue={order.original_currency || 'EUR'}>
                  <option value="EUR">EUR €</option>
                  <option value="PLN">PLN zł</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Клиент платит нам</label>
                <input
                  type="number"
                  name="client_price"
                  step="0.01"
                  required
                  defaultValue={order.original_client_price || 0}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Мы платим подрядчику</label>
                <input
                  type="number"
                  name="contractor_price"
                  step="0.01"
                  required
                  defaultValue={order.original_contractor_price || 0}
                  className={inputClass}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Изменение суммы или валюты пересчитает EUR по курсу на дату загрузки.
            </p>
          </div>

          {/* МАРШРУТ */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📍 Маршрут</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>Откуда</label>
                <input type="text" name="route_from" defaultValue={order.route_from || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Куда</label>
                <input type="text" name="route_to" defaultValue={order.route_to || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Дата загрузки</label>
                <input
                  type="date"
                  name="load_date"
                  defaultValue={order.load_date || ''}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Дата выгрузки</label>
                <input
                  type="date"
                  name="unload_date"
                  defaultValue={order.unload_date || ''}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Описание груза</label>
                <input
                  type="text"
                  name="cargo_description"
                  defaultValue={order.cargo_description || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* СТАТУС И ЗАМЕТКИ */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📋 Статус</h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>Статус</label>
                <select name="status" className={inputClass} defaultValue={order.status || 'planned'}>
                  <option value="planned">Планируется</option>
                  <option value="active">В пути</option>
                  <option value="completed">Завершена</option>
                  <option value="invoiced">Выставлен счёт</option>
                  <option value="paid">Оплачена</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Заметки</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={order.notes || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* КНОПКИ */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href={`/forwarding/${id}`}
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
            <button
              type="submit"
              className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить изменения
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
