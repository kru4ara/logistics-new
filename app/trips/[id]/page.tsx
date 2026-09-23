import { createClient } from '../../../lib/supabase-server';
import { addExpense, deleteExpense, deleteTrip } from '../../trip-actions';
import FileUpload from '../../driver/FileUpload';
import DocumentList from '../../driver/DocumentList';
import TripStatusButtons from '../../driver/TripStatusButtons';
import { saveTelemetry } from '../../telemetry-actions';
import CopyBlock from '../../components/CopyBlock';

export const dynamic = 'force-dynamic';

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  if (!tripId) return <div className="p-8">Ошибка: ID рейса не передан</div>;

  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, clients(name), drivers!driver_id(first_name, last_name, phone), trucks!truck_id(registration_number)')
    .eq('id', tripId)
    .single();

  if (tripError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {tripError.message}</div>;
  }

  let trailerNumber: string | null = null;
  if (trip.trailer_id) {
    const { data: trailer } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', trip.trailer_id)
      .single();
    trailerNumber = trailer?.registration_number || null;
  }

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  const { data: documents } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('uploaded_at', { ascending: false });

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = (trip.revenue_eur || 0) - totalExpenses;

  const refuelLiters = expenses?.filter((e) => e.category === 'fuel' && e.liters).reduce((sum, e) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  const driver = trip.drivers;
  const truck = trip.trucks;

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

  // ============================================================
  // ТЕКСТ ЗАДАНИЯ
  // ============================================================
  const taskLines: string[] = [];
  taskLines.push(`Тягач: ${truck?.registration_number || '—'}`);
  taskLines.push(`Прицеп: ${trailerNumber || '—'}`);
  taskLines.push(`Водитель: ${driver ? `${driver.first_name} ${driver.last_name}` : '—'}`);
  taskLines.push(`Телефон: ${driver?.phone || '—'}`);
  taskLines.push('');

  if (loadingPoints.length > 0) {
    taskLines.push('📍 ЗАГРУЗКА:');
    loadingPoints.forEach((p) => {
      const parts = [p.country, p.postal_code, p.city, p.address].filter(Boolean).join(', ');
      taskLines.push(`${p.num}. ${p.name || '—'}`);
      taskLines.push(`   ${parts || '—'}`);
      if (p.loading_number) {
        taskLines.push(`   № погрузки: ${p.loading_number}`);
      }
      taskLines.push('');
    });
  }

  if (trip.receiver_city || trip.receiver_name) {
    taskLines.push('🏁 ВЫГРУЗКА:');
    taskLines.push(`${trip.receiver_name || '—'}`);
    const recvParts = [
      trip.receiver_country,
      trip.receiver_postal_code,
      trip.receiver_city,
      trip.receiver_address,
    ].filter(Boolean).join(', ');
    taskLines.push(`   ${recvParts || '—'}`);
    if (trip.receiver_loading_number) {
      taskLines.push(`   № погрузки: ${trip.receiver_loading_number}`);
    }
  }

  const taskText = taskLines.join('\n');

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

  const expenseCategories: { value: string; label: string }[] = [
    { value: 'fuel', label: '⛽ Топливо' },
    { value: 'epi', label: '📄 EPI' },
    { value: 'etoll', label: '🛣 e-TOLL' },
    { value: 'border', label: '🛂 Граница' },
    { value: 'salary', label: '💶 ЗП водителя' },
    { value: 'contractor', label: '🚛 Подрядчик' },
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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/trips" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все рейсы
        </a>

        {/* Заголовок */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-medium">Рейс</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
                № {trip.trip_number || '—'}
              </h1>
              <div className="text-sm text-slate-500 mt-1">
                {trip.clients?.name || 'Клиент не указан'}
              </div>
              {trip.client_request_number && (
                <div className="text-sm text-slate-500 mt-1">
                  📄 Заявка № <b className="text-slate-700">{trip.client_request_number}</b>
                  {trip.client_request_date && (
                    <span className="text-slate-400 ml-2">
                      от {new Date(trip.client_request_date).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                </div>
              )}
            </div>
            <span className={`self-start px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/trips/${tripId}/edit`}
              className="flex-1 sm:flex-none text-center px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium
                         hover:bg-slate-100 transition-all text-sm"
            >
              ✏️ Редактировать
            </a>
            <form action={deleteTrip.bind(null, tripId)} className="flex-1 sm:flex-none">
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

        {/* Информация о рейсе */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
              <div className="text-slate-800 font-medium text-sm">{trip.route || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тягач / Прицеп</div>
              <div className="text-slate-800 font-medium text-sm">
                {truck?.registration_number || '—'}
                {trailerNumber && ` / ${trailerNumber}`}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Водитель</div>
              <div className="text-slate-800 font-medium text-sm">
                {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Телефон</div>
              <div className="text-slate-800 font-medium text-sm">
                {driver?.phone ? (
                  <a href={`tel:${driver.phone}`} className="hover:text-blue-600">{driver.phone}</a>
                ) : '—'}
              </div>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-3 mt-4 pt-4 border-t border-slate-100">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Фрахт</div>
              <div className="text-lg md:text-xl font-bold text-green-600">
                {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Топливо</div>
              <div className="text-lg md:text-xl font-bold text-blue-600">{trip.start_fuel_level || 0} л</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Старт</div>
              <div className="text-lg md:text-xl font-bold text-slate-800">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Точки маршрута */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📍 Маршрутные точки</h2>

          <div className="mb-6">
            <div className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
              🟢 Загрузка
              {loadingPoints.length > 1 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {loadingPoints.length} точки
                </span>
              )}
            </div>
            {loadingPoints.length === 0 ? (
              <div className="text-slate-400 text-sm pl-4">Не указана</div>
            ) : (
              <div className="space-y-3">
                {loadingPoints.map((p) => (
                  <div key={p.num} className="border-l-4 border-green-500 pl-4 py-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        #{p.num}
                      </span>
                      <span className="font-semibold text-slate-800 text-sm">{p.name || '—'}</span>
                    </div>
                    <div className="text-sm text-slate-600 mt-1">
                      {[p.country, p.postal_code, p.city, p.address].filter(Boolean).join(', ') || '—'}
                    </div>
                    {p.loading_number && (
                      <div className="text-xs text-slate-500 mt-1">
                        № погрузки: <span className="font-medium">{p.loading_number}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
              🔴 Выгрузка
            </div>
            {trip.receiver_city || trip.receiver_name ? (
              <div className="border-l-4 border-red-500 pl-4 py-1">
                <div className="font-semibold text-slate-800 text-sm">{trip.receiver_name || '—'}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {[trip.receiver_country, trip.receiver_postal_code, trip.receiver_city, trip.receiver_address]
                    .filter(Boolean).join(', ') || '—'}
                </div>
                {trip.receiver_loading_number && (
                  <div className="text-xs text-slate-500 mt-1">
                    № погрузки: <span className="font-medium">{trip.receiver_loading_number}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-sm pl-4">Не указана</div>
            )}
          </div>
        </div>

        <CopyBlock text={taskText} />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Действия по рейсу</h2>
          <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={true} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📊 Данные телеметрии</h2>
          <form action={async (formData: FormData) => {
            'use server';
            const km = parseFloat(formData.get('km') as string) || 0;
            const liters = parseFloat(formData.get('liters') as string) || 0;
            await saveTelemetry(tripId, km, liters);
          }} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">Пробег (км)</label>
              <input type="number" name="km" step="0.01" placeholder={trip.actual_km || '0'} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">Топливо (л)</label>
              <input type="number" name="liters" step="0.01" placeholder={trip.actual_liters || '0'} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </div>
            <button type="submit" className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all">
              Сохранить
            </button>
          </form>
          {trip.actual_km && trip.actual_km > 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm space-y-1">
              <p className="text-slate-700">
                <b>Текущие данные:</b> {trip.actual_km} км / {trip.actual_liters} л
              </p>
              <p className="text-emerald-600 font-bold">
                Средний расход: {((trip.actual_liters / trip.actual_km) * 100).toFixed(1)} л/100 км
              </p>
              <p className="text-blue-600 font-bold">
                Остаток в баке: {fuelLeft.toFixed(1)} л
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📎 Загрузить документы</h2>
          <FileUpload tripId={tripId} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📁 Загруженные файлы</h2>
          <DocumentList documents={documents || []} tripId={tripId} canDelete={true} />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💸 Расходы по рейсу</h2>

          {expenses?.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Пока нет расходов</div>
          ) : (
            <>
              <div className="md:hidden space-y-2">
                {expenses?.map((exp) => (
                  <div key={exp.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="font-semibold text-slate-800 text-sm">
                        {categoryLabel(exp.category)}
                      </div>
                      <form action={async () => {
                        'use server';
                        await deleteExpense(exp.id, tripId);
                      }}>
                        <button type="submit" className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 whitespace-nowrap">
                          Удалить
                        </button>
                      </form>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-400">Сумма</div>
                        <div className="font-medium text-slate-700">
                          {exp.original_amount} {exp.currency}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">В EUR</div>
                        <div className="font-bold text-red-500">{exp.amount_eur} €</div>
                      </div>
                      {exp.description && (
                        <div className="col-span-2">
                          <div className="text-slate-400">Описание</div>
                          <div className="text-slate-700">{exp.description}</div>
                        </div>
                      )}
                      <div className="col-span-2 text-right text-slate-400">
                        {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase">Категория</th>
                      <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Оплачено</th>
                      <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">EUR</th>
                      <th className="text-left py-3 text-xs font-semibold text-slate-500 uppercase pl-4">Описание</th>
                      <th className="text-right py-3 text-xs font-semibold text-slate-500 uppercase">Дата</th>
                      <th className="py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses?.map((exp) => (
                      <tr key={exp.id} className="border-b border-slate-50">
                        <td className="py-3 text-sm">{categoryLabel(exp.category)}</td>
                        <td className="py-3 text-right text-sm font-medium">
                          {exp.original_amount} {exp.currency}
                        </td>
                        <td className="py-3 text-right text-sm font-bold text-red-500">
                          {exp.amount_eur} €
                        </td>
                        <td className="py-3 pl-4 text-sm text-slate-600">{exp.description || '-'}</td>
                        <td className="py-3 text-right text-xs text-slate-500">
                          {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '-'}
                        </td>
                        <td className="py-3 text-right">
                          <form action={async () => {
                            'use server';
                            await deleteExpense(exp.id, tripId);
                          }}>
                            <button type="submit" className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1">
                              Удалить
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💰 Экономика рейса</h2>
          <div className="grid gap-4 grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Фрахт</div>
              <div className="text-lg md:text-xl font-bold text-green-600">{(trip.revenue_eur || 0).toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Расходы</div>
              <div className="text-lg md:text-xl font-bold text-red-500">{totalExpenses.toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Прибыль</div>
              <div className={`text-lg md:text-xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {profit.toFixed(2)} €
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">➕ Добавить расход</h2>
          <form action={addExpense} className="space-y-4">
            <input type="hidden" name="trip_id" value={tripId} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категория</label>
                <select name="category" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                  {expenseCategories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Валюта</label>
                <select name="currency" className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                  <option value="EUR">EUR</option>
                  <option value="PLN">PLN</option>
                  <option value="BYN">BYN</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Сумма</label>
                <input type="number" name="amount" step="0.01" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Литры (для топлива)</label>
                <input type="number" name="liters" step="0.01" placeholder="150" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Описание</label>
                <input type="text" name="description" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Дата</label>
                <input type="date" name="expense_date" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
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
