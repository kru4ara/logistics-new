import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';
import { addExpense, deleteExpense } from '../../../trip-actions';
import FileUpload from '../../FileUpload';
import DocumentList from '../../DocumentList';
import TripStatusButtons from '../../TripStatusButtons';

export const dynamic = 'force-dynamic';

export default async function DriverTripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  if (!tripId) return <div className="p-6">Ошибка: ID рейса не передан</div>;

  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'driver') redirect('/login');

  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('id', tripId)
    .single();

  if (tripError) return <div className="p-6 text-red-500">Ошибка: {tripError.message}</div>;

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  const { data: documents } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('uploaded_at', { ascending: false });

  const refuelLiters = expenses?.filter(e => e.category === 'fuel' && e.liters).reduce((sum, e) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  // ============================================================
  // ТОЧКИ ПОГРУЗКИ
  // ============================================================
  type LoadingPoint = {
    num: number;
    country: string | null;
    name: string | null;
    postal_code: string | null;
    city: string | null;
    address: string | null;
    loading_number: string | null;
  };

  const loadingPoints: LoadingPoint[] = [
    {
      num: 1,
      country: trip.sender_country,
      name: trip.sender_name,
      postal_code: trip.sender_postal_code,
      city: trip.sender_city,
      address: trip.sender_address,
      loading_number: trip.sender_loading_number,
    },
    {
      num: 2,
      country: trip.sender2_country,
      name: trip.sender2_name,
      postal_code: trip.sender2_postal_code,
      city: trip.sender2_city,
      address: trip.sender2_address,
      loading_number: trip.sender2_loading_number,
    },
    {
      num: 3,
      country: trip.sender3_country,
      name: trip.sender3_name,
      postal_code: trip.sender3_postal_code,
      city: trip.sender3_city,
      address: trip.sender3_address,
      loading_number: trip.sender3_loading_number,
    },
  ].filter((p) => p.city || p.name || p.country || p.address);

  const hasReceiver = Boolean(trip.receiver_city || trip.receiver_name);

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const expenseCategories: { value: string; label: string; emoji: string }[] = [
    { value: 'fuel', label: 'Топливо', emoji: '⛽' },
    { value: 'epi', label: 'EPI', emoji: '📄' },
    { value: 'etoll', label: 'e-TOLL', emoji: '🛣' },
    { value: 'border', label: 'Граница', emoji: '🛂' },
    { value: 'salary', label: 'ЗП водителя', emoji: '💶' },
    { value: 'contractor', label: 'Подрядчик', emoji: '🚛' },
    { value: 'permit', label: 'Дозвол', emoji: '📋' },
    { value: 'tlc', label: 'ТЛЦ', emoji: '🏭' },
    { value: 'waiting', label: 'Зона ожидания', emoji: '⏳' },
    { value: 'repair', label: 'Ремонт', emoji: '🔧' },
    { value: 'parking', label: 'Паркинг', emoji: '🅿️' },
    { value: 'disinfection', label: 'Дезинфекция', emoji: '🧴' },
    { value: 'ex1', label: 'ЕХ-1', emoji: '🧾' },
    { value: 'otkat', label: 'Откат', emoji: '🔄' },
    { value: 'gps_seal', label: 'GPS пломба', emoji: '📡' },
    { value: 'other', label: 'Другое', emoji: '📌' },
  ];

  function categoryEmoji(cat: string): string {
    return expenseCategories.find((c) => c.value === cat)?.emoji || '📌';
  }

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        {/* Назад */}
        <a href="/driver" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Мои рейсы
        </a>

        {/* Заголовок */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs text-slate-400 font-medium">Рейс № {trip.trip_number || '—'}</div>
              <h1 className="text-2xl font-bold text-slate-900 mt-1">
                {trip.clients?.name || 'Клиент не указан'}
              </h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>🛣</span>
            <span>{trip.route || '—'}</span>
          </div>
          <div className="text-xs text-slate-400 mt-3">
            📅 Дата старта: {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
          </div>
        </div>

        {/* Кнопки статуса */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Действия по рейсу</h2>
          <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={false} />
        </div>

        {/* Остаток топлива */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-200">Остаток топлива в баке</div>
              <div className="text-3xl font-bold mt-1">{fuelLeft.toFixed(1)} л</div>
            </div>
            <div className="text-5xl">⛽</div>
          </div>
          {trip.actual_liters && trip.actual_km ? (
            <div className="text-xs text-blue-200 mt-3">
              Последние данные: {trip.actual_km} км / {trip.actual_liters} л · Расход: {((trip.actual_liters / trip.actual_km) * 100).toFixed(1)} л/100 км
            </div>
          ) : null}
        </div>

        {/* Задание */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">📋 Задание</h2>

          {loadingPoints.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">📍 Загрузка</span>
                {loadingPoints.length > 1 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {loadingPoints.length} точки
                  </span>
                )}
              </div>

              {loadingPoints.map((p) => (
                <div key={p.num} className="border-l-4 border-green-500 pl-4 py-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      #{p.num}
                    </span>
                    <div className="font-bold text-slate-900">{p.name || 'Отправитель не указан'}</div>
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    {[p.postal_code, p.city, p.address].filter(Boolean).join(', ') || '—'}
                  </div>
                  {p.country && (
                    <div className="text-sm text-slate-500 mt-1">🌍 {p.country}</div>
                  )}
                  {p.loading_number && (
                    <div className="text-sm text-blue-600 font-semibold mt-1">
                      🚪 Погрузочный номер: {p.loading_number}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {hasReceiver && (
            <div className="border-l-4 border-blue-500 pl-4 py-1">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">🏁 Выгрузка</div>
              <div className="font-bold text-slate-900">{trip.receiver_name || 'Получатель не указан'}</div>
              <div className="text-sm text-slate-600 mt-1">
                {trip.receiver_postal_code} {trip.receiver_city}, {trip.receiver_address}
              </div>
              <div className="text-sm text-slate-500 mt-1">🌍 {trip.receiver_country}</div>
              {trip.receiver_loading_number && (
                <div className="text-sm text-blue-600 font-semibold mt-1">
                  🚪 Погрузочный номер: {trip.receiver_loading_number}
                </div>
              )}
            </div>
          )}

          {loadingPoints.length === 0 && !hasReceiver && (
            <div className="text-slate-400 text-sm text-center py-6">
              Адреса загрузки и выгрузки не заполнены
            </div>
          )}
        </div>

        {/* Загрузка документов */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📎 Загрузить документы</h2>
          <p className="text-sm text-slate-500 mb-4">
            Загрузите CMR с отметкой о выгрузке, фото груза и другие рабочие документы.
          </p>
          <FileUpload tripId={tripId} />
        </div>

        {/* Загруженные документы */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📁 Загруженные файлы</h2>
          <DocumentList
            documents={documents || []}
            tripId={tripId}
            canDelete={true}
          />
        </div>

        {/* Расходы */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💸 Расходы по рейсу</h2>

          {expenses?.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">Пока нет расходов</div>
          ) : (
            <div className="space-y-2">
              {expenses?.map((exp) => (
                <div key={exp.id} className="flex justify-between items-center border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">{categoryEmoji(exp.category)}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 text-sm">
                        {exp.description || exp.category}
                      </div>
                      <div className="text-xs text-slate-400">
                        {exp.original_amount} {exp.currency} · {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : ''}
                      </div>
                    </div>
                  </div>
                  <form action={async () => {
                    'use server';
                    await deleteExpense(exp.id, tripId);
                  }}>
                    <button type="submit" className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1">
                      Удалить
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Добавить расход */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">➕ Добавить расход</h2>
          <form action={addExpense} className="space-y-4">
            <input type="hidden" name="trip_id" value={tripId} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Категория</label>
                <select name="category" required className={inputClass}>
                  {expenseCategories.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
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
                <label className={labelClass}>Литры (для топлива)</label>
                <input type="number" name="liters" step="0.01" placeholder="150" className={inputClass} />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Описание</label>
                <input type="text" name="description" placeholder="Комментарий" className={inputClass} />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>Дата</label>
                <input type="date" name="expense_date" className={inputClass} />
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

      </div>
    </main>
  );
}
