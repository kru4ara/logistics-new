import { supabase } from '../../../lib/supabaseClient';
import { addExpense, deleteExpense, deleteTrip } from '../../trip-actions';
import FileUpload from '../../driver/FileUpload';
import TripStatusButtons from '../../driver/TripStatusButtons';
import { saveTelemetry } from '../../telemetry-actions';
import CopyBlock from '../../components/CopyBlock';

export const dynamic = 'force-dynamic';

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  if (!tripId) return <div className="p-8">Ошибка: ID рейса не передан</div>;

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, clients(name), drivers!driver_id(first_name, last_name, phone), trucks!truck_id(registration_number)')
    .eq('id', tripId)
    .single();

  if (tripError) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {tripError.message}</div>;
  }

  // Прицеп — отдельным запросом (из-за конфликта связей)
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
    .eq('trip_id', tripId);

  const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  const profit = (trip.revenue_eur || 0) - totalExpenses;

  const refuelLiters = expenses?.filter((e) => e.category === 'fuel' && e.liters).reduce((sum, e) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  const driver = trip.drivers;
  const truck = trip.trucks;

  // Формируем текст задания для копирования
  const taskText = [
    `🚛 Рейс № ${trip.trip_number || '—'}`,
    `Клиент: ${trip.clients?.name || '—'}`,
    `Маршрут: ${trip.route || '—'}`,
    '',
    `Тягач: ${truck?.registration_number || '—'}`,
    `Прицеп: ${trailerNumber || '—'}`,
    `Водитель: ${driver ? `${driver.first_name} ${driver.last_name}` : '—'}`,
    `Телефон: ${driver?.phone || '—'}`,
    '',
    '📍 ЗАГРУЗКА',
    `Компания: ${trip.sender_name || '—'}`,
    `Адрес: ${[trip.sender_postal_code, trip.sender_city, trip.sender_address, trip.sender_country].filter(Boolean).join(', ') || '—'}`,
    `Погрузочный номер: ${trip.sender_loading_number || '—'}`,
    '',
    '🏁 ВЫГРУЗКА',
    `Компания: ${trip.receiver_name || '—'}`,
    `Адрес: ${[trip.receiver_postal_code, trip.receiver_city, trip.receiver_address, trip.receiver_country].filter(Boolean).join(', ') || '—'}`,
    `Погрузочный номер: ${trip.receiver_loading_number || '—'}`,
  ].join('\n');

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        {/* Назад */}
        <a href="/trips" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все рейсы
        </a>

        {/* Заголовок с действиями */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-slate-900">
            Рейс № {trip.trip_number || '—'}
          </h1>
          <div className="flex gap-3">
            <a
              href={`/trips/${tripId}/edit`}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium
                         hover:bg-slate-100 transition-all text-sm"
            >
              ✏️ Редактировать
            </a>
            <form action={deleteTrip.bind(null, tripId)}>
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

        {/* Информация о рейсе */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium">Клиент</div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {trip.clients?.name || 'Не указан'}
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Маршрут</div>
              <div className="text-slate-800 font-medium">{trip.route || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Тягач / Прицеп</div>
              <div className="text-slate-800 font-medium">
                {truck?.registration_number || '—'}
                {trailerNumber && ` / ${trailerNumber}`}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Водитель</div>
              <div className="text-slate-800 font-medium">
                {driver ? `${driver.first_name} ${driver.last_name}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Телефон</div>
              <div className="text-slate-800 font-medium">{driver?.phone || '—'}</div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mt-4 pt-4 border-t border-slate-100">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Фрахт</div>
              <div className="text-xl font-bold text-green-600">
                {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Остаток топлива</div>
              <div className="text-xl font-bold text-blue-600">{trip.start_fuel_level || 0} л</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Дата старта</div>
              <div className="text-xl font-bold text-slate-800">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* 🔥 НОВЫЙ БЛОК: Задание для водителя (копируемое) */}
        <CopyBlock text={taskText} />

        {/* Кнопки статуса */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Действия по рейсу</h2>
          <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={true} />
        </div>

        {/* Данные телеметрии */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📊 Данные телеметрии</h2>
          <form action={async (formData: FormData) => {
            'use server';
            const km = parseFloat(formData.get('km') as string) || 0;
            const liters = parseFloat(formData.get('liters') as string) || 0;
            await saveTelemetry(tripId, km, liters);
          }} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Пробег (км)</label>
              <input type="number" name="km" step="0.01" placeholder={trip.actual_km || '0'} className="rounded-lg border border-slate-300 px-3 py-2 w-32" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Топливо (л)</label>
              <input type="number" name="liters" step="0.01" placeholder={trip.actual_liters || '0'} className="rounded-lg border border-slate-300 px-3 py-2 w-32" />
            </div>
            <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all">
              Сохранить
            </button>
          </form>
          {trip.actual_km && trip.actual_km > 0 && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-700">
                <b>Текущие данные:</b> {trip.actual_km} км / {trip.actual_liters} л
              </p>
              <p className="text-emerald-600 font-bold mt-1">
                Средний расход: {((trip.actual_liters / trip.actual_km) * 100).toFixed(1)} л/100 км
              </p>
              <p className="text-blue-600 font-bold">
                Остаток в баке: {fuelLeft.toFixed(1)} л
              </p>
            </div>
          )}
        </div>

        {/* Загрузка документов */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📎 Загрузить документы</h2>
          <FileUpload tripId={tripId} />
        </div>

        {/* Загруженные документы */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📁 Загруженные файлы</h2>
          {documents?.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">Файлы ещё не загружены</div>
          ) : (
            <div className="space-y-2">
              {documents?.map((doc) => (
                <a
                  key={doc.id}
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`}
                  target="_blank"
                  className="flex justify-between items-center border border-slate-100 rounded-xl p-3
                             hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">📄</span>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate text-sm">{doc.original_name}</div>
                      <div className="text-xs text-slate-400">
                        {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('ru-RU') : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-blue-600 text-sm font-medium whitespace-nowrap">Открыть</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Расходы */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💸 Расходы по рейсу</h2>
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
              {expenses?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">Пока нет расходов</td></tr>
              ) : (
                expenses?.map((exp) => (
                  <tr key={exp.id} className="border-b border-slate-50">
                    <td className="py-3 text-sm">
                      {exp.category === 'fuel' ? '⛽ Топливо' :
                       exp.category === 'epi' ? '📄 EPI' :
                       exp.category === 'etoll' ? '🛣 e-TOLL' :
                       exp.category === 'border' ? '🛂 Граница' :
                       exp.category === 'salary' ? '💶 ЗП водителя' :
                       exp.category === 'contractor' ? '🚛 Подрядчик' : exp.category}
                    </td>
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Экономика */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">💰 Экономика рейса</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Фрахт</div>
              <div className="text-xl font-bold text-green-600">{(trip.revenue_eur || 0).toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Расходы</div>
              <div className="text-xl font-bold text-red-500">{totalExpenses.toFixed(2)} €</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Прибыль</div>
              <div className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {profit.toFixed(2)} €
              </div>
            </div>
          </div>
        </div>

        {/* Добавить расход */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">➕ Добавить расход</h2>
          <form action={addExpense} className="space-y-4">
            <input type="hidden" name="trip_id" value={tripId} />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Категория</label>
                <select name="category" required className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                  <option value="fuel">⛽ Топливо</option>
                  <option value="epi">📄 EPI</option>
                  <option value="etoll">🛣 e-TOLL</option>
                  <option value="border">🛂 Граница</option>
                  <option value="salary">💶 ЗП водителя</option>
                  <option value="contractor">🚛 Подрядчик</option>
                  <option value="other">📌 Другое</option>
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
