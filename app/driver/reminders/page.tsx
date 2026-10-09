import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Clock,
  User as UserIcon,
  Truck as TruckIcon,
  Book,
  ScanLine,
  Car,
  CreditCard,
  FileBadge,
  AlertTriangle,
  Shield,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase-server';

export const dynamic = 'force-dynamic';

type DocDef = { label: string; value: string | null; Icon: LucideIcon };

export default async function DriverRemindersPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;

  if (role !== 'driver' || !driverId) redirect('/login');

  const supabase = await createClient();

  const { data: driver } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', driverId)
    .single();

  const { data: activeTrips } = await supabase
    .from('trips')
    .select('truck_id')
    .eq('driver_id', driverId)
    .in('status', ['active', 'planned'])
    .order('trip_number', { ascending: false })
    .limit(1);

  const truckId = activeTrips?.[0]?.truck_id;

  let truck = null;
  if (truckId) {
    const { data } = await supabase
      .from('trucks')
      .select('*')
      .eq('id', truckId)
      .single();
    truck = data;
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

  const driverDocs: DocDef[] = driver ? [
    { label: 'Паспорт', value: driver.passport_expiry, Icon: Book },
    { label: 'Виза', value: driver.visa_expiry, Icon: ScanLine },
    { label: 'Водительское удостоверение', value: driver.license_expiry, Icon: Car },
    { label: 'Карта тахографа', value: driver.tachograph_card_expiry, Icon: CreditCard },
    { label: 'Код 95', value: driver.code_95_expiry, Icon: FileBadge },
    { label: 'АДР', value: driver.adr_expiry, Icon: AlertTriangle },
  ] : [];

  const truckDocs: DocDef[] = truck ? [
    { label: 'Страховка ОС', value: truck.truck_insurance_expiry, Icon: Shield },
    { label: 'Техосмотр', value: truck.tech_inspection_expiry, Icon: Wrench },
    { label: 'Пограничная страховка РБ', value: truck.border_insurance_expiry, Icon: ScanLine },
    { label: 'Легализация тахографа', value: truck.tachograph_legalization_expiry, Icon: CreditCard },
  ] : [];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        {/* Заголовок */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-brand-600" />
            Напоминания
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Следите за сроками документов</p>
        </div>

        {/* Мои документы */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-brand-600" />
            Мои документы
          </h2>
          <div className="space-y-2">
            {driverDocs.map((doc) => {
              const badge = statusBadge(doc.value);
              return (
                <div
                  key={doc.label}
                  className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl p-3"
                >
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
            })}
          </div>
        </div>

        {/* Документы машины */}
        {truck ? (
          <div className="card p-5 md:p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TruckIcon className="w-5 h-5 text-brand-600" />
                  Документы машины
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {truck.registration_number} · {truck.type === 'tractor' ? 'Тягач' : 'Прицеп'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {truckDocs.map((doc) => {
                const badge = statusBadge(doc.value);
                return (
                  <div
                    key={doc.label}
                    className="flex items-center justify-between gap-3 border border-slate-100 rounded-xl p-3"
                  >
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
              })}
            </div>
          </div>
        ) : (
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
