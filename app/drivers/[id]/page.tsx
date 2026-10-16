import { createClient } from '../../../lib/supabase-server';
import { buildRouteMap, type SegmentRouteRow } from '../../../lib/trip-route';
import { accrueDriverDebt, payOutDriverDebt, deleteDriverTransaction } from '../../driver-debts-actions';
import DocumentUpload from '../../components/DocumentUpload';
import TelegramLinkCard from './TelegramLinkCard';
import SubmitButton from '../../components/SubmitButton';
import {
  ArrowLeft,
  Pencil,
  User as UserIcon,
  Phone,
  BarChart3,
  Route as RouteIcon,
  FileText,
  Calendar,
  FolderOpen,
  BookOpen,
  Globe,
  Car,
  CreditCard,
  ScrollText,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Gauge,
  Fuel,
  Inbox,
  Truck,
  HandCoins,
  ArrowDownCircle,
  ArrowUpCircle,
  PlusCircle,
  Trash2,
  Download,
  Container,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

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

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return (rel[0] as any)?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp')
  );
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverId } = await params;
  if (!driverId) return <div className="p-8">Ошибка: ID водителя не передан</div>;

  const supabase = await createClient();

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  if (driverError) return <div className="p-8 text-red-500">Ошибка загрузки: {driverError.message}</div>;

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('entity_type', 'driver')
    .eq('entity_id', driverId)
    .order('uploaded_at', { ascending: false });

  // ⬅️ НОВОЕ: ищем фото паспорта (картинка)
  const passportPhotoDoc = (documents || []).find(
    (d: any) => d.document_type === 'passport' && isImagePath(d.file_path || '')
  );
  const passportPhotoUrl = passportPhotoDoc
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${passportPhotoDoc.file_path}`
    : null;

  // ⬅️ НОВОЕ: последний активный/планируемый рейс — тянем тягач и прицеп
  const { data: currentTripRaw } = await supabase
    .from('trips')
    .select('id, trip_number, truck_id, trailer_id, trucks!truck_id(registration_number), trailers:trucks!trailer_id(registration_number)')
    .eq('driver_id', driverId)
    .in('status', ['active', 'planned'])
    .order('trip_number', { ascending: false })
    .limit(1);

  const currentTrip: any = currentTripRaw?.[0] || null;
  const currentTruck = pickOne<{ registration_number: string | null }>(currentTrip?.trucks);
  const currentTrailer = pickOne<{ registration_number: string | null }>(currentTrip?.trailers);

  // Расчёты
  const { data: transactions } = await supabase
    .from('driver_transactions')
    .select('*')
    .eq('driver_id', driverId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });

  let accruedTotal = 0;
  let paidOutTotal = 0;
  for (const t of transactions || []) {
    if (t.type === 'accrual') accruedTotal += Number(t.amount_eur) || 0;
    else if (t.type === 'payout') paidOutTotal += Number(t.amount_eur) || 0;
  }
  const balance = accruedTotal - paidOutTotal;

  // Рейсы водителя
  const { data: trips } = await supabase
    .from('trips')
    .select('id, trip_number, status, revenue_eur, actual_km, actual_liters, start_date, end_date, clients(name)')
    .eq('driver_id', driverId)
    .order('trip_number', { ascending: false });

  const tripIds = (trips || []).map((t) => t.id);
  const routeByTrip = new Map<string, string>();
  if (tripIds.length > 0) {
    const { data: segRows } = await supabase
      .from('trip_segments')
      .select('trip_id, position, from_city, from_country, to_city, to_country')
      .in('trip_id', tripIds);

    const routeMap = buildRouteMap((segRows || []) as SegmentRouteRow[]);
    routeMap.forEach((info, tripId) => {
      if (info.route) routeByTrip.set(tripId, info.route);
    });
  }

  const totalTrips = trips?.length || 0;
  const totalRevenue = (trips || []).reduce((s, t) => s + (t.revenue_eur || 0), 0);
  const totalKm = (trips || []).reduce((s, t) => s + (t.actual_km || 0), 0);
  const totalLiters = (trips || []).reduce((s, t) => s + (t.actual_liters || 0), 0);
  const avgConsumption = totalKm > 0 ? (totalLiters / totalKm) * 100 : null;
  const activeTripsCount = (trips || []).filter((t) => t.status === 'active').length;
  const lastTrips = (trips || []).slice(0, 5);

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function daysBadge(dateString: string | null) {
    const days = getDaysUntil(dateString);
    if (days === null) return { color: 'bg-slate-100 text-slate-500 border-slate-200', label: '—' };
    if (days < 0) return { color: 'bg-red-50 text-red-700 border-red-200', label: `${days} дн.` };
    if (days < 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: `${days} дн.` };
    return { color: 'bg-green-50 text-green-700 border-green-200', label: `${days} дн.` };
  }

  function downloadBadge(lastDate: string | null, warnAfter: number, maxAfter: number) {
    const days = getDaysUntil(lastDate);
    if (lastDate === null || days === null) {
      return {
        color: 'bg-slate-100 text-slate-500 border-slate-200',
        label: 'нет данных',
        daysAgo: null as number | null,
      };
    }
    const daysAgo = -days;
    if (daysAgo > maxAfter) {
      return {
        color: 'bg-red-50 text-red-700 border-red-200',
        label: `просрочено · ${daysAgo} дн.`,
        daysAgo,
      };
    }
    if (daysAgo > warnAfter) {
      return {
        color: 'bg-orange-50 text-orange-700 border-orange-200',
        label: `${daysAgo} дн.`,
        daysAgo,
      };
    }
    return {
      color: 'bg-green-50 text-green-700 border-green-200',
      label: `${daysAgo} дн.`,
      daysAgo,
    };
  }

  const DRIVER_CARD_PERIOD = 28;
  const DRIVER_CARD_WARN = 25;
  const driverCardBadge = downloadBadge(driver.driver_card_last_download, DRIVER_CARD_WARN, DRIVER_CARD_PERIOD);

  const initials = `${driver.first_name?.[0] || ''}${driver.last_name?.[0] || ''}`.toUpperCase();

  const documentFields = [
    { label: 'Паспорт', value: driver.passport_expiry, Icon: BookOpen },
    { label: 'Виза', value: driver.visa_expiry, Icon: Globe },
    { label: 'Водительское', value: driver.license_expiry, Icon: Car },
    { label: 'Карта тахографа', value: driver.tachograph_card_expiry, Icon: CreditCard },
    { label: 'Код 95', value: driver.code_95_expiry, Icon: ScrollText },
    { label: 'АДР', value: driver.adr_expiry, Icon: AlertTriangle },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/drivers" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все водители
        </a>

        {/* ВИЗИТКА ВОДИТЕЛЯ */}
        <div className="card p-5 md:p-6">
          <div className="flex flex-col md:flex-row gap-5 md:gap-6">

            {/* Фото паспорта */}
            <div className="shrink-0 self-start">
              {passportPhotoUrl ? (
                <a
                  href={passportPhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-32 h-40 md:w-40 md:h-52 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-soft hover:shadow-soft-lg transition-shadow"
                  title="Открыть фото паспорта"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={passportPhotoUrl}
                    alt={`Фото паспорта — ${driver.first_name} ${driver.last_name}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ) : (
                <div className="w-32 h-40 md:w-40 md:h-52 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500
                                flex items-center justify-center text-white font-bold text-3xl md:text-4xl shadow-brand">
                  {initials || <UserIcon className="w-10 h-10" strokeWidth={2} />}
                </div>
              )}
            </div>

            {/* Данные */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 break-words tracking-tight">
                    {driver.first_name} {driver.last_name}
                  </h1>
                  {driver.date_of_birth && (
                    <div className="text-sm text-slate-500 mt-1 tabular-nums">
                      Дата рождения: {new Date(driver.date_of_birth).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>

                <a
                  href={`/drivers/${driverId}/edit`}
                  className="btn btn-primary w-full sm:w-auto text-sm md:text-base shrink-0"
                >
                  <Pencil className="w-4 h-4" strokeWidth={2} />
                  Редактировать
                </a>
              </div>

              {/* Телефоны */}
              {(driver.phone_by || driver.phone_pl) && (
                <div className="space-y-1 mb-4">
                  {driver.phone_by && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-semibold text-slate-400 w-6">BY</span>
                      <a href={`tel:${driver.phone_by}`} className="hover:text-brand-600 font-medium tabular-nums">
                        {driver.phone_by}
                      </a>
                    </div>
                  )}
                  {driver.phone_pl && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-semibold text-slate-400 w-6">PL</span>
                      <a href={`tel:${driver.phone_pl}`} className="hover:text-brand-600 font-medium tabular-nums">
                        {driver.phone_pl}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Текущая машина */}
              {currentTrip && (currentTruck?.registration_number || currentTrailer?.registration_number) && (
                <div className="mb-4 p-3 rounded-xl bg-brand-50/50 border border-brand-100">
                  <div className="text-xs uppercase tracking-wide text-brand-600 font-semibold mb-1.5">
                    Сейчас на рейсе №{currentTrip.trip_number || '—'}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                    {currentTruck?.registration_number && (
                      <span className="inline-flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={2} />
                        <span className="tabular-nums font-semibold">{currentTruck.registration_number}</span>
                      </span>
                    )}
                    {currentTrailer?.registration_number && (
                      <span className="inline-flex items-center gap-1.5">
                        <Container className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={2} />
                        <span className="tabular-nums font-semibold">{currentTrailer.registration_number}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Паспортные данные */}
              {(driver.passport_series || driver.passport_number || driver.passport_issued_by || driver.passport_issued_date) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                    Паспорт
                  </div>
                  <div className="grid gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
                    {(driver.passport_series || driver.passport_number) && (
                      <div>
                        <span className="text-slate-400">Серия и номер: </span>
                        <span className="font-semibold tabular-nums">
                          {[driver.passport_series, driver.passport_number].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}
                    {driver.passport_issued_date && (
                      <div>
                        <span className="text-slate-400">Дата выдачи: </span>
                        <span className="font-semibold tabular-nums">
                          {new Date(driver.passport_issued_date).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    )}
                    {driver.passport_issued_by && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-400">Кем выдан: </span>
                        <span className="font-semibold">{driver.passport_issued_by}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* 💰 РАСЧЁТЫ С ВОДИТЕЛЕМ */}
        <div className="card p-5 md:p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Расчёты
          </h2>

          <div className={`rounded-2xl p-5 ${
            balance > 0
              ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
              : balance < 0
                ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
                : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white'
          }`}>
            <div className="text-sm text-white/80">
              {balance > 0 ? 'Компания должна водителю' : balance < 0 ? 'Водитель должен компании' : 'Долг закрыт'}
            </div>
            <div className="text-3xl font-bold mt-1 tabular-nums">
              {Math.abs(balance).toFixed(2)} €
            </div>
            <div className="flex gap-x-4 gap-y-1 mt-3 text-xs text-white/80 flex-wrap">
              <span>Начислено: <b className="text-white tabular-nums">{accruedTotal.toFixed(2)} €</b></span>
              <span>·</span>
              <span>Выплачено: <b className="text-white tabular-nums">{paidOutTotal.toFixed(2)} €</b></span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-emerald-600" strokeWidth={2.2} />
                <div className="text-sm font-bold text-slate-800">Погасить долг</div>
              </div>
              <p className="text-xs text-slate-500">
                Отметить, что офис выдал водителю деньги.
              </p>
              <form action={payOutDriverDebt} className="space-y-2">
                <input type="hidden" name="driver_id" value={driverId} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" name="amount" step="0.01" required placeholder="Сумма" className="input" />
                  <select name="currency" className="input">
                    <option value="EUR">EUR</option>
                    <option value="PLN">PLN</option>
                    <option value="BYN">BYN</option>
                  </select>
                </div>
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required className="input" />
                <input type="text" name="notes" placeholder="Комментарий (наличные / перевод / зачёт в ЗП)" className="input" />
                <SubmitButton
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  pendingText="Сохраняю…"
                >
                  <ArrowUpCircle className="w-4 h-4" strokeWidth={2.2} />
                  Погасить
                </SubmitButton>
              </form>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-amber-600" strokeWidth={2.2} />
                <div className="text-sm font-bold text-slate-800">Начислить вручную</div>
              </div>
              <p className="text-xs text-slate-500">
                Внести долг без привязки к расходу рейса.
              </p>
              <form action={accrueDriverDebt} className="space-y-2">
                <input type="hidden" name="driver_id" value={driverId} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" name="amount" step="0.01" required placeholder="Сумма" className="input" />
                  <select name="currency" className="input">
                    <option value="EUR">EUR</option>
                    <option value="PLN">PLN</option>
                    <option value="BYN">BYN</option>
                  </select>
                </div>
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required className="input" />
                <input type="text" name="notes" placeholder="Комментарий (за что должны)" className="input" />
                <SubmitButton
                  className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white font-semibold py-2.5 rounded-xl transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  pendingText="Сохраняю…"
                >
                  <ArrowDownCircle className="w-4 h-4" strokeWidth={2.2} />
                  Начислить
                </SubmitButton>
              </form>
            </div>
          </div>

          {transactions && transactions.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
                История операций ({transactions.length})
              </div>
              <div className="space-y-1.5">
                {transactions.slice(0, 20).map((t: any) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {t.type === 'accrual' ? (
                        <ArrowDownCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2.2} />
                      ) : (
                        <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" strokeWidth={2.2} />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800">
                          {t.type === 'accrual' ? 'Начислено' : 'Выплачено'}
                        </div>
                        {t.notes && (
                          <div className="text-xs text-slate-500 break-words mt-0.5">
                            {t.notes}
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                          {t.date ? new Date(t.date).toLocaleDateString('ru-RU') : '—'}
                          {t.original_amount && t.currency && t.currency !== 'EUR' && (
                            <> · {t.original_amount} {t.currency}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`text-sm font-bold whitespace-nowrap tabular-nums ${
                        t.type === 'accrual' ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {t.type === 'accrual' ? '+' : '−'}{Number(t.amount_eur).toFixed(2)} €
                      </div>
                      <form action={async () => {
                        'use server';
                        await deleteDriverTransaction(t.id, driverId);
                      }}>
                        <button
                          type="submit"
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          aria-label="Удалить операцию"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
                {transactions.length > 20 && (
                  <div className="text-xs text-slate-400 text-center pt-2">
                    Показаны последние 20 из {transactions.length}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 📥 Считывание карты водителя */}
        <div className="card p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Считывание карты водителя
            </h2>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${driverCardBadge.color}`}>
              {driverCardBadge.label}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
                Последнее считывание
              </div>
              <div className="text-slate-800 font-medium tabular-nums">
                {driver.driver_card_last_download
                  ? new Date(driver.driver_card_last_download).toLocaleDateString('ru-RU')
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
                Лимит
              </div>
              <div className="text-slate-800 font-medium tabular-nums">
                {DRIVER_CARD_PERIOD} дн. (предупреждение с {DRIVER_CARD_WARN})
              </div>
            </div>
          </div>

          {driverCardBadge.daysAgo === null && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              💡 Дата последнего считывания не указана. Внесите её через <b>«Редактировать»</b>.
            </div>
          )}

          {driverCardBadge.daysAgo !== null && driverCardBadge.daysAgo > DRIVER_CARD_PERIOD && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2.2} />
              <span>
                <b>Просрочено!</b> Карту водителя нужно считывать не реже <b>{DRIVER_CARD_PERIOD} дней</b> —
                иначе данные тахографа перезаписываются и теряются. Считайте как можно скорее.
              </span>
            </div>
          )}
        </div>

        {/* 📊 Сводка по работе */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            Работа
          </h2>
          <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Всего рейсов</span>
                <BarChart3 className="w-4 h-4 text-brand-600" strokeWidth={2} />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">{totalTrips}</div>
              {activeTripsCount > 0 && (
                <div className="text-xs text-brand-500 mt-1">в пути: {activeTripsCount}</div>
              )}
            </div>
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Общий фрахт</span>
                <TrendingUp className="w-4 h-4 text-green-600" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold text-green-600 break-words tabular-nums">
                {totalRevenue > 0 ? `${Math.round(totalRevenue).toLocaleString('ru-RU')} €` : '—'}
              </div>
            </div>
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Пройдено</span>
                <Gauge className="w-4 h-4 text-slate-600" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800 break-words tabular-nums">
                {totalKm > 0 ? `${Math.round(totalKm).toLocaleString('ru-RU')} км` : '—'}
              </div>
            </div>
            <div className="card p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Ср. расход</span>
                <Fuel className="w-4 h-4 text-slate-600" strokeWidth={2} />
              </div>
              <div className="text-xl md:text-2xl font-bold text-slate-800 tabular-nums">
                {avgConsumption !== null ? `${avgConsumption.toFixed(1)} л/100` : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* 🚚 Последние рейсы */}
        {lastTrips.length > 0 && (
          <div className="card p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-2 mb-4 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <RouteIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
                Последние рейсы
              </h2>
              {totalTrips > 5 && (
                <span className="text-xs text-slate-400">
                  показано 5 из {totalTrips}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {lastTrips.map((t) => {
                const clientName = pickName(t.clients) || '—';
                const dateStr = t.end_date || t.start_date;
                const routeDisplay = routeByTrip.get(t.id) || '—';
                return (
                  <a
                    key={t.id}
                    href={`/trips/${t.id}`}
                    className="block border border-slate-100 rounded-xl p-3 md:p-4 bg-slate-50/40
                               hover:bg-brand-50/40 hover:border-brand-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-slate-400 tabular-nums">
                            № {t.trip_number || '—'}
                          </span>
                          <span className={`text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap
                                            ${statusColors[t.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {statusLabels[t.status] || t.status}
                          </span>
                          {dateStr && (
                            <span className="text-xs text-slate-500 tabular-nums">
                              · {new Date(dateStr).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-slate-800 break-words">
                          {clientName}
                        </div>
                        <div className="flex items-start gap-1.5 text-xs text-slate-500 mt-0.5">
                          <RouteIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="break-words">{routeDisplay}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-bold text-green-600 whitespace-nowrap tabular-nums">
                          {t.revenue_eur ? `${t.revenue_eur} €` : '—'}
                        </div>
                        {t.actual_km && (
                          <div className="text-xs text-slate-400 tabular-nums">
                            {Math.round(t.actual_km)} км
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Telegram */}
        <TelegramLinkCard
          driverId={driverId}
          isConnected={Boolean(driver.telegram_chat_id)}
        />

        {/* Сроки документов */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Сроки документов
          </h2>
          <div className="grid gap-3 md:gap-4 sm:grid-cols-2 md:grid-cols-3">
            {documentFields.map((doc) => {
              const badge = daysBadge(doc.value);
              const Icon = doc.Icon;
              return (
                <div key={doc.label} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={2} />
                    <span className="text-sm font-semibold text-slate-700">{doc.label}</span>
                  </div>
                  <div className="text-slate-800 font-medium mb-2 tabular-nums">
                    {doc.value ? new Date(doc.value).toLocaleDateString('ru-RU') : '—'}
                  </div>
                  <div className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border tabular-nums ${badge.color}`}>
                    {badge.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Загруженные документы */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Загруженные файлы
          </h2>
          {documents?.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Inbox className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
              </div>
              <div className="text-slate-400 text-sm">Файлы ещё не загружены</div>
            </div>
          ) : (
            <div className="space-y-2">
              {documents?.map((doc) => (
                <div key={doc.id} className="flex justify-between items-center gap-3 border border-slate-100 rounded-xl p-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-brand-600" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{doc.document_type}</div>
                      <div className="text-xs text-slate-400 tabular-nums">
                        {doc.expiry_date ? `до ${new Date(doc.expiry_date).toLocaleDateString('ru-RU')}` : 'без срока'}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline font-medium text-sm whitespace-nowrap shrink-0"
                  >
                    Смотреть
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Загрузка документов */}
        <div className="card p-5 md:p-6">
          <DocumentUpload entityType="driver" entityId={driverId} />
        </div>

      </div>
    </main>
  );
}
