import Link from 'next/link';
import { Pencil, User as UserIcon, Phone, Truck, Container } from 'lucide-react';
import DriverPassportUpload from '../../components/DriverPassportUpload';

export default function DriverHeader({
  driver,
  driverId,
  passportPhotoUrl,
  initials,
  currentTrip,
  currentTruck,
  currentTrailer,
}: {
  driver: any;
  driverId: string;
  passportPhotoUrl: string | null;
  initials: string;
  currentTrip: any;
  currentTruck: any;
  currentTrailer: any;
}) {
  return (
    <div className="card p-5 md:p-6">
      <div className="flex flex-col md:flex-row gap-5 md:gap-6">
        {/* Фото паспорта */}
        <div className="shrink-0 self-start">
          {passportPhotoUrl ? (
            <a
              href={passportPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-56 h-40 md:w-64 md:h-44 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-soft hover:shadow-soft-lg transition-shadow"
              title="Открыть фото паспорта"
            >
              <img
                src={passportPhotoUrl}
                alt={`Фото паспорта — ${driver.first_name} ${driver.last_name}`}
                className="w-full h-full object-cover"
              />
            </a>
          ) : (
            <div className="w-56 h-40 md:w-64 md:h-44 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500
                            flex items-center justify-center text-white font-bold text-3xl md:text-4xl shadow-brand">
              {initials || <UserIcon className="w-10 h-10" strokeWidth={2} />}
            </div>
          )}
          <DriverPassportUpload driverId={driverId} hasPhoto={Boolean(passportPhotoUrl)} />
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

            <Link
              href={`/drivers/${driverId}/edit`}
              className="btn btn-primary w-full sm:w-auto text-sm md:text-base shrink-0"
            >
              <Pencil className="w-4 h-4" strokeWidth={2} />
              Редактировать
            </Link>
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
  );
}
