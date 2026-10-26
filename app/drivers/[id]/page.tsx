import Link from 'next/link';
import { createClient } from '../../../lib/supabase-server';
import { buildRouteMap, type SegmentRouteRow } from '../../../lib/trip-route';
import TelegramLinkCard from './TelegramLinkCard';
import DriverHeader from './DriverHeader';
import DriverFinance from './DriverFinance';
import DriverCardDownload from './DriverCardDownload';
import DriverStats from './DriverStats';
import DriverTrips from './DriverTrips';
import {
  ArrowLeft,
  Calendar,
  BookOpen,
  Globe,
  Car,
  CreditCard,
  ScrollText,
  AlertTriangle,
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

  const passportPhotoDoc = (documents || []).find(
    (d: any) => d.document_type === 'passport' && isImagePath(d.file_path || '')
  );
  const passportPhotoUrl = passportPhotoDoc
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${passportPhotoDoc.file_path}`
    : null;

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
      return { color: 'bg-slate-100 text-slate-500 border-slate-200', label: 'нет данных', daysAgo: null as number | null };
    }
    const daysAgo = -days;
    if (daysAgo > maxAfter) return { color: 'bg-red-50 text-red-700 border-red-200', label: `просрочено · ${daysAgo} дн.`, daysAgo };
    if (daysAgo > warnAfter) return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: `${daysAgo} дн.`, daysAgo };
    return { color: 'bg-green-50 text-green-700 border-green-200', label: `${daysAgo} дн.`, daysAgo };
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

        <Link href="/drivers" className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все водители
        </Link>

        <DriverHeader
          driver={driver}
          driverId={driverId}
          passportPhotoUrl={passportPhotoUrl}
          initials={initials}
          currentTrip={currentTrip}
          currentTruck={currentTruck}
          currentTrailer={currentTrailer}
        />

        <DriverFinance
          driverId={driverId}
          transactions={transactions || []}
          accruedTotal={accruedTotal}
          paidOutTotal={paidOutTotal}
          balance={balance}
        />

        <DriverCardDownload
          driver={driver}
          driverCardBadge={driverCardBadge}
          DRIVER_CARD_PERIOD={DRIVER_CARD_PERIOD}
          DRIVER_CARD_WARN={DRIVER_CARD_WARN}
        />

        <DriverStats
          totalTrips={totalTrips}
          activeTripsCount={activeTripsCount}
          totalRevenue={totalRevenue}
          totalKm={totalKm}
          avgConsumption={avgConsumption}
        />

        <DriverTrips
          lastTrips={lastTrips}
          totalTrips={totalTrips}
          routeByTrip={routeByTrip}
          statusLabels={statusLabels}
          statusColors={statusColors}
        />

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

      </div>
    </main>
  );
}
