import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Route as RouteIcon,
  Rocket,
  Flag,
  MapPin,
  Package,
  Settings2,
  Fuel,
  AlertTriangle,
  Paperclip,
  FolderOpen,
  Receipt,
  PlusCircle,
  Trash2,
  Calendar,
  Globe,
  DoorOpen,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '../../../../lib/supabase-server';
import { addExpense, deleteExpense } from '../../../trip-actions';
import FileUpload from '../../FileUpload';
import DocumentList from '../../DocumentList';
import TripStatusButtons from '../../TripStatusButtons';

export const dynamic = 'force-dynamic';

const NEGATIVE_FUEL_TOLERANCE = -200;

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

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

  const { data: subcontractors } = await supabase
    .from('trip_subcontractors')
    .select('id, position, unload_country, unload_city, unload_address, unload_company, unload_postal_code, unload_date')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  const refuelLiters = expenses?.filter(e => e.category === 'fuel' && e.liters).reduce((sum, e) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  const fuelLeftIsNegative = fuelLeft < 0;
  const fuelLeftIsCritical = fuelLeft < NEGATIVE_FUEL_TOLERANCE;

  const clientName = pickName(trip.clients) || 'Клиент не указан';

  let consolidationPoint: {
    country: string | null;
    city: string | null;
    address: string | null;
    company: string | null;
    postal_code: string | null;
    unload_date: string | null;
  } | null = null;

  if (subcontractors && subcontractors.length > 0) {
    const sorted = [...subcontractors].sort((a: any, b: any) => {
      const posDiff = (b.position || 0) - (a.position || 0);
      if (posDiff !== 0) return posDiff;
      const aDate = a.unload_date ? new Date(a.unload_date).getTime() : 0;
      const bDate = b.unload_date ? new Date(b.unload_date).getTime() : 0;
      return bDate - aDate;
    });
    const last = sorted[0] as any;
    consolidationPoint = {
      country: last.unload_country,
      city: last.unload_city,
      address: last.unload_address,
      company: last.unload_company,
      postal_code: last.unload_postal_code,
      unload_date: last.unload_date,
    };
  }

  type LoadingPoint = {
    num: number;
    country: string | null;
    name: string | null;
    postal_code: string | null;
    city: string | null;
    address: string | null;
    loading_number: string | null;
  };

  const senderPoints: LoadingPoint[] = [
    { num: 1, country: trip.sender_country, name: trip.sender_name, postal_code: trip.sender_postal_code, city: trip.sender_city, address: trip.sender_address, loading_number: trip.sender_loading_number },
    { num: 2, country: trip.sender2_country, name: trip.sender2_name, postal_code: trip.sender2_postal_code, city: trip.sender2_city, address: trip.sender2_address, loading_number: trip.sender2_loading_number },
    { num: 3, country: trip.sender3_country, name: trip.sender3_name, postal_code: trip.sender3_postal_code, city: trip.sender3_city, address: trip.sender3_address, loading_number: trip.sender3_loading_number },
  ].filter((p) => p.city || p.name || p.country || p.address);

  const hasReceiver = Boolean(trip.receiver_city || trip.receiver_name);
  const useConsolidation = Boolean(consolidationPoint);

  const statusLabels: Record<string, string> = {
    planned: 'Планируется',
    active: 'В пути',
    completed: 'Завершён',
    invoiced: 'Выставлен счёт',
    paid: 'Оплачен',
  };

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-brand-50 text-brand-700 border-brand-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  // Emoji в категориях оставлены — они идут в <option> (нативный select)
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

  function categoryLabel(cat: string): string {
    return expenseCategories.find((c) => c.value === cat)?.label || cat;
  }

  const inputClass = 'input';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  const fuelCardClass = fuelLeftIsCritical
    ? 'bg-gradient-to-br from-red-600 to-red-800'
    : fuelLeftIsNegative
      ? 'bg-gradient-to-br from-amber-500 to-amber-700'
      : 'bg-gradient-to-br from-brand-600 to-brand-800';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        <a
          href="/driver"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Мои рейсы
        </a>

        {/* Заголовок */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400 font-medium tabular-nums">
                Рейс № {trip.trip_number || '—'}
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1 break-words">
                {clientName}
              </h1>
            </div>
            <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          <div className="flex items-start gap-2 text-sm text-slate-600 mb-3">
            <RouteIcon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" strokeWidth={2} />
            <span className="break-words">{trip.route || '—'}</span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-slate-600 inline-flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
              Старт: <b className="text-slate-800 tabular-nums">
                {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
              </b>
            </span>
            {trip.end_date ? (
              <span className="text-emerald-700 inline-flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" strokeWidth={2} />
                Финиш: <b className="tabular-nums">{new Date(trip.end_date).toLocaleDateString('ru-RU')}</b>
              </span>
            ) : (
              <span className="text-slate-400 inline-flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" strokeWidth={2} />
                Финиш: —
              </span>
            )}
          </div>
        </div>

        {/* Кнопки статуса */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-500" strokeWidth={2} />
            Действия по рейсу
          </h2>
          <TripStatusButtons tripId={tripId} currentStatus={trip.status} showAdminStatuses={false} />
        </div>

        {/* Остаток топлива */}
        <div className={`${fuelCardClass} rounded-2xl p-5 shadow-lg text-white`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-white/80">Остаток топлива в баке</div>
              <div className="text-3xl font-bold mt-1 tabular-nums">{fuelLeft.toFixed(1)} л</div>
            </div>
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Fuel className="w-7 h-7" strokeWidth={2} />
            </div>
          </div>

          {fuelLeftIsNegative && (
            <div className="mt-3 rounded-xl px-3 py-2 text-xs font-medium bg-white/15 text-white flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>
                {fuelLeftIsCritical
                  ? 'Значительный недостаток топлива. Проверьте заправки и данные о расходе — цифры выглядят недостоверными.'
                  : 'Остаток отрицательный (в пределах нормы). Расхождение факта и учёта по топливу.'}
              </span>
            </div>
          )}

          {trip.actual_liters && trip.actual_km ? (
            <div className="text-xs text-white/80 mt-3 tabular-nums">
              Последние данные: {trip.actual_km} км / {trip.actual_liters} л · Расход: {((trip.actual_liters / trip.actual_km) * 100).toFixed(1)} л/100 км
            </div>
          ) : null}
        </div>

        {/* Задание */}
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Задание
          </h2>

          {useConsolidation && consolidationPoint ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                  Загрузка
                </span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  после подрядчика
                </span>
              </div>

              <div className="border-l-4 border-amber-500 pl-3 py-1">
                <div className="font-bold text-slate-900 text-sm break-words">
                  {consolidationPoint.company || 'Перегрузка'}
                </div>
                <div className="text-sm text-slate-600 mt-1 break-words">
                  {[consolidationPoint.postal_code, consolidationPoint.city, consolidationPoint.country]
                    .filter(Boolean).join(', ') || '—'}
                </div>
                {consolidationPoint.address && (
                  <div className="text-sm text-slate-600 mt-1 break-words">
                    {consolidationPoint.address}
                  </div>
                )}
              </div>
            </div>
          ) : (
            senderPoints.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                    Загрузка
                  </span>
                  {senderPoints.length > 1 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {senderPoints.length} точки
                    </span>
                  )}
                </div>

                {senderPoints.map((p) => (
                  <div key={p.num} className="border-l-4 border-green-500 pl-3 py-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded tabular-nums">
                        #{p.num}
                      </span>
                      <div className="font-bold text-slate-900 text-sm break-words">
                        {p.name || 'Отправитель не указан'}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 mt-1 break-words">
                      {[p.postal_code, p.city, p.address].filter(Boolean).join(', ') || '—'}
                    </div>
                    {p.country && (
                      <div className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" strokeWidth={2} />
                        {p.country}
                      </div>
                    )}
                    {p.loading_number && (
                      <div className="text-sm text-brand-600 font-semibold mt-1 inline-flex items-center gap-1.5">
                        <DoorOpen className="w-3.5 h-3.5" strokeWidth={2.2} />
                        Погрузочный номер: {p.loading_number}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {hasReceiver && (
            <div className="border-l-4 border-brand-500 pl-3 py-1">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1 inline-flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" strokeWidth={2} />
                Выгрузка
              </div>
              <div className="font-bold text-slate-900 text-sm break-words">{trip.receiver_name || 'Получатель не указан'}</div>
              <div className="text-sm text-slate-600 mt-1 break-words">
                {trip.receiver_postal_code} {trip.receiver_city}, {trip.receiver_address}
              </div>
              <div className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" strokeWidth={2} />
                {trip.receiver_country}
              </div>
              {trip.receiver_loading_number && (
                <div className="text-sm text-brand-600 font-semibold mt-1 inline-flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5" strokeWidth={2.2} />
                  Погрузочный номер: {trip.receiver_loading_number}
                </div>
              )}
            </div>
          )}

          {!useConsolidation && senderPoints.length === 0 && !hasReceiver && (
            <div className="text-slate-400 text-sm text-center py-6">
              Адреса загрузки и выгрузки не заполнены
            </div>
          )}
        </div>

        {/* Загрузка документов */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Загрузить документы
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Загрузите CMR с отметкой о выгрузке, фото груза и другие рабочие документы.
          </p>
          <FileUpload tripId={tripId} />
        </div>

        {/* Загруженные документы */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Загруженные файлы
          </h2>
          <DocumentList
            documents={documents || []}
            tripId={tripId}
            canDelete={true}
          />
        </div>

        {/* Расходы */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Расходы по рейсу
          </h2>

          {expenses?.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">Пока нет расходов</div>
          ) : (
            <div className="space-y-2">
              {expenses?.map((exp) => (
                <div key={exp.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-semibold text-slate-800 text-sm flex-1 min-w-0 truncate">
                      {categoryLabel(exp.category)}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-400 tabular-nums">
                        {exp.original_amount} {exp.currency}
                      </div>
                      <div className="font-bold text-red-500 text-sm tabular-nums">
                        {exp.amount_eur} €
                      </div>
                    </div>
                  </div>

                  {exp.description && (
                    <div className="text-xs text-slate-600 mb-2 break-words">
                      {exp.description}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <span className="text-xs text-slate-400 inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar className="w-3 h-3" strokeWidth={2} />
                      {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('ru-RU') : '—'}
                    </span>
                    <form action={async () => {
                      'use server';
                      await deleteExpense(exp.id, tripId);
                    }}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={2} />
                        Удалить
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Добавить расход */}
        <div className="card p-5">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Добавить расход
          </h2>
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-emerald-600/20 transition-all duration-150 active:scale-[0.98]
                         inline-flex items-center justify-center gap-2"
            >
              <PlusCircle className="w-4 h-4" strokeWidth={2.5} />
              Добавить расход
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}
