import { redirect } from 'next/navigation';
import { getSessionContext } from '../../../lib/session';
import {
  Clock,
  User as UserIcon,
  Truck as TruckIcon,
  Container,
  Book,
  ScanLine,
  Car,
  CreditCard,
  FileBadge,
  AlertTriangle,
  Shield,
  Wrench,
  ClipboardCheck,
  Download,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';

export const dynamic = 'force-dynamic';

type DocDef = { label: string; value: string | null; Icon: LucideIcon };

const DRIVER_CARD_PERIOD = 28;      // карту водителя — не реже 28 дней
const DRIVER_CARD_WARN = 25;         // предупреждение за 3 дня
const TACHO_PERIOD = 96;             // тахограф — не реже 96 дней
const TACHO_WARN = 90;               // предупреждение за 6 дней

export default async function DriverRemindersPage() {
  const { role, driverId } = await getSessionContext();

  if (role !== 'driver' || !driverId) redirect('/login');

  const supabase = await createClient();

  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  const { data: activeTrips } = await supabase
    .from('trips')
    .select('truck_id, trailer_id')
    .eq('driver_id', driverId)
    .in('status', ['active', 'planned'])
    .order('trip_number', { ascending: false })
    .limit(1);

  const truckId = activeTrips?.[0]?.truck_id;
  const trailerId = activeTrips?.[0]?.trailer_id;

  let truck = null;
  if (truckId) {
    const { data } = await supabase.from('trucks').select('*').eq('id', truckId).single();
    truck = data;
  }

  let trailer = null;
  if (trailerId) {
    const { data } = await supabase.from('trucks').select('*').eq('id', trailerId).single();
    trailer = data;
  }

  function getDaysUntil(dateString: string | null) {
    if (!dateString) return null;
    const today = new Date();
    const target = new Date(dateString);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  function statusBadge(dateString: string | null) {
    const days = getDaysUntil(dateString);
    if (days === null) return { color: 'bg-slate-100 text-slate-500 border-slate-200', label: '—' };
    if (days < 0) return { color: 'bg-red-50 text-red-700 border-red-200', label: `${days} дн.` };
    if (days < 30) return { color: 'bg-orange-50 text-orange-700 border-orange-200', label: `${days} дн.` };
    return { color: 'bg-green-50 text-green-700 border-green-200', label: `${days} дн.` };
  }

  // Специальный badge для "периодического считывания":
  // считаем сколько дней ПРОШЛО с last_download, а не сколько осталось
  function downloadBadge(lastDate: string | null, warnAfter: number, maxAfter: number) {
    const days = getDaysUntil(lastDate); // это будет отрицательное число (сколько дней назад)
    if (lastDate === null) {
      return {
        color: 'bg-slate-100 text-slate-500 border-slate-200',
        label: 'нет данных',
        hint: null as string | null,
      };
    }
    const daysAgo = days === null ? 0 : -days;
    if (daysAgo > maxAfter) {
      return {
        color: 'bg-red-50 text-red-700 border-red-200',
        label: `просрочено · ${daysAgo} дн.`,
        hint: `Считать срочно (лимит ${maxAfter} дн.)`,
      };
    }
    if (daysAgo > warnAfter) {
      return {
        color: 'bg-orange-50 text-orange-700 border-orange-200',
        label: `${daysAgo} дн.`,
        hint: `Осталось ${maxAfter - daysAgo} дн. до лимита`,
      };
    }
    return {
      color: 'bg-green-50 text-green-700 border-green-200',
      label: `${daysAgo} дн.`,
      hint: `Лимит через ${maxAfter - daysAgo} дн.`,
    };
  }

  const driverDocs: DocDef[] = driver ? [
    { label: 'Паспорт', value: driver.passport_expiry, Icon: Book },
    { label: 'Виза', value: driver.visa_expiry, Icon: ScanLine },
    { label: 'Водительское удостоверение', value: driver.license_expiry, Icon: Car },
    { label: 'Карта тахографа', value: driver.tachograph_card_expiry, Icon: CreditCard },
    { label: 'Код 95', value: driver.code_95_expiry, Icon: FileBadge },
    { label: 'АДР', value: driver.adr_expiry, Icon: AlertTriangle },
  ] : [];

  const tractorDocs: DocDef[] = truck && truck.type === 'tractor'
    ? [
        { label: 'Страховка ОС', value: truck.truck_insurance_expiry, Icon: Shield },
        { label: 'ТО (техобслуживание)', value: truck.to_expiry, Icon: Wrench },
        { label: 'Техосмотр', value: truck.tech_inspection_expiry, Icon: ClipboardCheck },
        { label: 'Пограничная страховка РБ', value: truck.border_insurance_expiry, Icon: ScanLine },
        { label: 'Калибровка тахографа', value: truck.tachograph_calibration_expiry, Icon: CreditCard },
      ]
    : [];

  const trailerDocs: DocDef[] = trailer
    ? [
        { label: 'Страховка ОС', value: trailer.truck_insurance_expiry, Icon: Shield },
        { label: 'Техосмотр', value: trailer.tech_inspection_expiry, Icon: ClipboardCheck },
        { label: 'Пограничная страховка РБ', value: trailer.border_insurance_expiry, Icon: ScanLine },
        { label: 'Таможенный сертификат', value: trailer.customs_certificate_expiry, Icon: FileBadge },
      ]
    : [];

  const driverCardBadge = driver
    ? downloadBadge(driver.driver_card_last_download, DRIVER_CARD_WARN, DRIVER_CARD_PERIOD)
    : null;

  const tachoBadge = truck
    ? downloadBadge(truck.tachograph_last_download, TACHO_WARN, TACHO_PERIOD)
    : null;

  function DocRow({ doc }: { doc: DocDef }) {
    const badge = statusBadge(doc.value);
    return (
      <div className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl p-3">
        <div className="flex items-center gap-3 min-w-0">
          <doc.Icon className="w-5 h-5 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-slate-800 text-sm truncate">{doc.label}</div>
            <div className="text-xs text-slate-400">
              {doc.value ? new Date(doc.value).toLocaleDateString('ru-RU') : '—'}
            </div>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${badge.color}`}>
          {badge.label}
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-600" />
            Напоминания
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Следите за сроками документов и считыванием тахографа</p>
        </div>

        {/* Считывание данных */}
        {(driver?.driver_card_last_download !== undefined || truck?.tachograph_last_download !== undefined) && (
          <div className="card p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-600" />
              Считывание данных тахографа
            </h2>

            <div className="space-y-2">
              {/* Карта водителя */}
              {driverCardBadge && (
                <div className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CreditCard className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 text-sm">
                        Карта водителя
                      </div>
                      <div className="text-xs text-slate-400">
                        {driver?.driver_card_last_download
                          ? `Последнее: ${new Date(driver.driver_card_last_download).toLocaleDateString('ru-RU')} · лимит ${DRIVER_CARD_PERIOD} дн.`
                          : `Не считана ни разу · лимит ${DRIVER_CARD_PERIOD} дн.`}
                      </div>
                      {driverCardBadge.hint && (
                        <div className="text-xs text-slate-500 mt-0.5">{driverCardBadge.hint}</div>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${driverCardBadge.color}`}>
                    {driverCardBadge.label}
                  </span>
                </div>
              )}

              {/* Тахограф тягача */}
              {tachoBadge && (
                <div className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Download className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 text-sm">
                        Тахограф {truck?.registration_number ? `· ${truck.registration_number}` : ''}
                      </div>
                      <div className="text-xs text-slate-400">
                        {truck?.tachograph_last_download
                          ? `Последнее: ${new Date(truck.tachograph_last_download).toLocaleDateString('ru-RU')} · лимит ${TACHO_PERIOD} дн.`
                          : `Не считан ни разу · лимит ${TACHO_PERIOD} дн.`}
                      </div>
                      {tachoBadge.hint && (
                        <div className="text-xs text-slate-500 mt-0.5">{tachoBadge.hint}</div>
                      )}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${tachoBadge.color}`}>
                    {tachoBadge.label}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Мои документы */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-brand-600" />
            Мои документы
          </h2>
          <div className="space-y-2">
            {driverDocs.map((doc) => <DocRow key={doc.label} doc={doc} />)}
          </div>
        </div>

        {/* Документы тягача */}
        {truck && truck.type === 'tractor' && (
          <div className="card p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-brand-600" />
              Документы тягача
            </h2>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              {truck.registration_number}
            </p>
            <div className="space-y-2">
              {tractorDocs.map((doc) => <DocRow key={doc.label} doc={doc} />)}
            </div>
          </div>
        )}

        {/* Документы прицепа */}
        {trailer && (
          <div className="card p-5 md:p-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Container className="w-5 h-5 text-brand-600" />
              Документы прицепа
            </h2>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              {trailer.registration_number}
            </p>
            <div className="space-y-2">
              {trailerDocs.map((doc) => <DocRow key={doc.label} doc={doc} />)}
            </div>
          </div>
        )}

        {/* Пусто */}
        {!truck && !trailer && (
          <div className="card p-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <TruckIcon className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Машина не назначена</h2>
            <p className="text-slate-500 text-sm">У вас нет активного рейса с машиной</p>
          </div>
        )}

      </div>
    </main>
  );
}
