import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import { deleteForwarding } from '../actions';
import { addForwardingExpense, deleteForwardingExpense } from '../expense-actions';
import ForwardingStatusButtons from './ForwardingStatusButtons';
import ContractorDocxButton from './ContractorDocxButton';

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

const expenseCategories: { value: string; label: string }[] = [
  { value: 'fuel', label: '⛽ Топливо' },
  { value: 'epi', label: '📄 EPI' },
  { value: 'etoll', label: '🛣 e-TOLL' },
  { value: 'border', label: '🛂 Граница' },
  { value: 'permit', label: '📋 Дозвол' },
  { value: 'tlc', label: '🏭 ТЛЦ' },
  { value: 'waiting', label: '⏳ Зона ожидания' },
  { value: 'repair', label: '🔧 Ремонт' },
  { value: 'parking', label: '🅿️ Паркинг' },
  { value: 'disinfection', label: '🧴 Дезинфекция' },
  { value: 'ex1', label: '🧾 ЕХ-1' },
  { value: 'otkat', label: '🔄 Откат' },
  { value: 'gps_seal', label: '📡 GPS пломба' },
  { value: 'other', label: '📌 Другое' },
];

function categoryLabel(cat: string): string {
  return expenseCategories.find((c) => c.value === cat)?.label || cat;
}

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

function pickField(rel: unknown, field: string): string | undefined {
  if (!rel) return undefined;
  const obj = Array.isArray(rel) ? rel[0] : rel;
  if (typeof obj === 'object' && obj !== null && field in obj) {
    return (obj as Record<string, string | undefined>)[field];
  }
  return undefined;
}

export default async function ForwardingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: order, error } = await supabase
    .from('forwarding_orders')
    .select('*, clients(name, contact_person, phone)')
    .eq('id', id)
    .single();

  if (error || !order) {
    return <div className="p-8 text-red-500">Заявка не найдена</div>;
  }

  // Загружаем расходы
  const { data: expenses } = await supabase
    .from('forwarding_expenses')
    .select('*')
    .eq('forwarding_id', id)
    .order('expense_date', { ascending: false });

  // Загружаем подрядчиков
  const { data: contractorsList } = await supabase
    .from('forwarding_contractors')
    .select('*, contractors(name, phone)')
    .eq('forwarding_id', id)
    .order('position');

  const clientPrice = order.client_price_eur || 0;
  const totalContractors = contractorsList?.reduce((sum, c) => sum + (c.price_eur || 0), 0) || 0;
  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;

  const margin = clientPrice - totalContractors - totalExpenses;
  const marginPct = clientPrice > 0 ? (margin / clientPrice) * 100 : 0;

  const originalCurrency = order.original_currency || 'EUR';
  const showOriginal = originalCurrency !== 'EUR';

  const clientName = pickName(order.clients) || '—';
  const clientContact = pickField(order.clients, 'contact_person');
  const clientPhone = pickField(order.clients, 'phone');

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/forwarding" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все заявки
        </a>

        {/* Заголовок */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 break-words">
                📦 Заявка #{order.order_number || '—'}
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                {order.load_date ? new Date(order.load_date).toLocaleDateString('ru-RU') : 'Дата не указана'}
              </p>
              {order.client_request_number && (
                <p className="text-sm text-slate-500 mt-1">
                  📄 Заявка клиента № <b className="text-slate-700">{order.client_request_number}</b>
                  {order.client_request_date && (
                    <span className="text-slate-400 ml-2">
                      от {new Date(order.client_request_date).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 sm:shrink-0">
              <a
                href={`/forwarding/${id}/edit`}
                className="flex-1 sm:flex-none text-center px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium
                           hover:bg-slate-100 transition-all text-sm"
              >
                ✏️ Редактировать
              </a>
              <form action={deleteForwarding.bind(null, id)} className="flex-1 sm:flex-none">
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                             hover:bg-red-500 hover:text-white transition-all text-sm font-medium"
                >
                  🗑️ Удалить
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Статус */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-2">Статус</div>
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border
            ${statusColors[order.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
            {statusLabels[order.status] || order.status}
          </span>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <ForwardingStatusButtons orderId={id} currentStatus={order.status} />
          </div>
        </div>

        {/* Экономика */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💰 Экономика</h2>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Клиент платит</div>
              <div className="text-xl md:text-2xl font-bold text-green-600 break-words">{clientPrice.toFixed(2)} €</div>
              {showOriginal && (
                <div className="text-xs text-slate-400 mt-1">
                  ({order.original_client_price?.toFixed(2)} {originalCurrency})
                </div>
              )}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Подрядчику (сумма)</div>
              <div className="text-xl md:text-2xl font-bold text-red-500 break-words">{totalContractors.toFixed(2)} €</div>
            </div>
          </div>

          {totalExpenses > 0 && (
            <div className="mb-4 pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Доп. расходы</div>
                <div className="text-lg font-bold text-orange-600">−{totalExpenses.toFixed(2)} €</div>
              </div>
            </div>
          )}

          <div className="pt-3 border-t-2 border-slate-200">
            <div className="flex justify-between items-baseline gap-3">
              <div className="text-sm uppercase tracking-wide text-slate-500 font-bold">Наша маржа</div>
              <div className={`text-2xl md:text-3xl font-bold break-words ${margin >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {margin.toFixed(2)} €
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1 text-right">
              {marginPct.toFixed(1)}% от суммы клиента
            </div>
          </div>
        </div>

        {/* Клиент */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">🤝 Клиент</h2>
          <div className="border-l-4 border-green-500 pl-4 py-1">
            <div className="font-bold text-slate-900 break-words">{clientName}</div>
            {clientContact && (
              <div className="text-sm text-slate-600 mt-1">👤 {clientContact}</div>
            )}
            {clientPhone && (
              <div className="text-sm text-slate-600 mt-1">
                📞 <a href={`tel:${clientPhone}`} className="hover:text-blue-600">{clientPhone}</a>
              </div>
            )}
          </div>
        </div>

        {/* Подрядчики */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            🚛 Подрядчики
            {contractorsList && contractorsList.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {contractorsList.length}
              </span>
            )}
          </h2>

          {(!contractorsList || contractorsList.length === 0) ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              Подрядчики не указаны.{' '}
              <a href={`/forwarding/${id}/edit`} className="text-blue-600 hover:underline">
                Добавить
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {contractorsList.map((c, idx) => {
                const cName = pickName(c.contractors) || '—';
                const cPhone = pickField(c.contractors, 'phone');
                const showOrig = (c.currency || 'EUR') !== 'EUR';

                return (
                  <div key={c.id} className="border-l-4 border-red-500 pl-4 py-2">
                    <div className="flex flex-wrap items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <div className="font-bold text-slate-900 break-words">{cName}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <div className="text-red-500 font-semibold">
                        {c.price_eur?.toFixed(2)} €
                      </div>
                      {showOrig && (
                        <div className="text-xs text-slate-400">
                          ({c.original_price?.toFixed(2)} {c.currency})
                        </div>
                      )}
                      {cPhone && (
                        <a href={`tel:${cPhone}`} className="text-slate-600 hover:text-blue-600 text-xs">
                          📞 {cPhone}
                        </a>
                      )}
                    </div>

                    {/* № машины и водитель + срок оплаты */}
                    {(c.truck_number || c.driver_name || c.payment_days) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                        {c.truck_number && (
                          <span>🚛 <b>{c.truck_number}</b></span>
                        )}
                        {c.driver_name && (
                          <span>👤 {c.driver_name}</span>
                        )}
                        {c.payment_days && (
                          <span>💶 {c.payment_days} дн.</span>
                        )}
                      </div>
                    )}

                    {/* Заметки к подрядчику */}
                    {c.notes && (
                      <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2 mt-2 break-words">
                        📝 {c.notes}
                      </div>
                    )}

                    {/* Кнопка генерации DOCX */}
                    <div className="mt-3">
                      <ContractorDocxButton
                        forwardingId={id}
                        contractorId={c.id}
                        contractorName={cName}
                      />
                    </div>
                  </div>
                );
              })}

              {contractorsList.length > 1 && (
                <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Итого подрядчикам</span>
                  <span className="text-lg font-bold text-red-500">{totalContractors.toFixed(2)} €</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Маршрут */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📍 Маршрут</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Откуда</div>
              <div className="text-slate-800 font-medium break-words">{order.route_from || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Куда</div>
              <div className="text-slate-800 font-medium break-words">{order.route_to || '—'}</div>
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
            {order.loading_reference && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Reference loading</div>
                <div className="text-slate-800 font-medium break-words">{order.loading_reference}</div>
              </div>
            )}
          </div>
        </div>

        {/* Детали перевозки */}
        {(order.transport_type || order.cargo_type || order.cargo_quantity || order.customs_loading || order.customs_unloading) && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">📦 Детали перевозки</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {order.transport_type && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тип транспорта</div>
                  <div className="text-slate-800 font-medium break-words">{order.transport_type}</div>
                </div>
              )}
              {order.cargo_type && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тип груза</div>
                  <div className="text-slate-800 font-medium break-words">{order.cargo_type}</div>
                </div>
              )}
              {order.cargo_quantity && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Количество</div>
                  <div className="text-slate-800 font-medium break-words">{order.cargo_quantity}</div>
                </div>
              )}
              {order.customs_loading && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Таможня (загрузка)</div>
                  <div className="text-slate-800 font-medium break-words">{order.customs_loading}</div>
                </div>
              )}
              {order.customs_unloading && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Таможня (выгрузка)</div>
                  <div className="text-slate-800 font-medium break-words">{order.customs_unloading}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Расходы */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💸 Доп. расходы</h2>

          {(!expenses || expenses.length === 0) ? (
            <div className="text-center py-6 text-slate-400 text-sm">Пока нет расходов</div>
          ) : (
            <div className="space-y-2">
              {expenses.map((exp) => (
                <div key={exp.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-semibold text-slate-800 text-sm flex-1 min-w-0 truncate">
                      {categoryLabel(exp.category)}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400">
                        {exp.original_amount} {exp.currency}
                      </div>
                      <div className="font-bold text-orange-600 text-sm">
                        {exp.amount_eur.toFixed(2)} €
                      </div>
                    </div>
                  </div>
                  {exp.description && (
                    <div className="text-xs text-slate-600 mb-2 break-words">
                      {exp.description}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <span className="text-xs text-slate-400">
                      📅 {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                    <form action={async () => {
                      'use server';
                      await deleteForwardingExpense(exp.id, id);
                    }}>
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                      >
                        🗑 Удалить
                      </button>
                    </form>
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700">Итого расходов</span>
                <span className="text-lg font-bold text-orange-600">{totalExpenses.toFixed(2)} €</span>
              </div>
            </div>
          )}
        </div>

        {/* Добавить расход */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">➕ Добавить расход</h2>
          <form action={addForwardingExpense} className="space-y-4">
            <input type="hidden" name="forwarding_id" value={id} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Категория</label>
                <select name="category" required className={inputClass}>
                  {expenseCategories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Валюта</label>
                <select name="currency" className={inputClass}>
                  <option value="EUR">EUR</option>
                  <option value="PLN">PLN</option>
                  <option value="BYN">BYN</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Сумма</label>
                <input type="number" name="amount" step="0.01" required className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Дата</label>
                <input type="date" name="expense_date" className={inputClass} />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Описание</label>
                <input type="text" name="description" placeholder="Комментарий" className={inputClass} />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Добавить расход
            </button>
          </form>
        </div>

        {/* Заметки */}
        {order.notes && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">📝 Заметки</h2>
            <div className="text-slate-700 whitespace-pre-wrap break-words">{order.notes}</div>
          </div>
        )}

      </div>
    </main>
  );
}
