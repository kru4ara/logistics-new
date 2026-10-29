import Link from 'next/link';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { pickName } from '../lib/relations';

export type OverdueReminder = { id: string; title: string; days: number };

export type TripRef = {
  id: string;
  trip_number: string | null;
  clients?: unknown;
  clientName?: string | null;
  driverName?: string | null;
};

type Props = {
  overdueReminders: OverdueReminder[];
  tripsWithoutDriver: TripRef[];
  tripsWithoutTruck: TripRef[];
  tripsWithoutSalary: TripRef[];
};

/** Блок «Требует внимания» на странице «Сегодня». */
export default function TodayAttention({
  overdueReminders,
  tripsWithoutDriver,
  tripsWithoutTruck,
  tripsWithoutSalary,
}: Props) {
  const count =
    overdueReminders.length +
    tripsWithoutDriver.length +
    tripsWithoutTruck.length +
    tripsWithoutSalary.length;
  if (count === 0) return null;

  return (
          <div className="card border-l-4 border-l-amber-500 p-5 md:p-6">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={2.2} />
              Требует внимания
            </h2>

            <div className="space-y-4">
              {overdueReminders.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-red-600 font-semibold mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" strokeWidth={2.2} />
                    Просроченные напоминания · {overdueReminders.length}
                  </div>
                  <div className="space-y-1.5">
                    {overdueReminders.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="truncate">{r.title}</span>
                        <span className="ml-auto text-xs text-red-600 whitespace-nowrap tabular-nums">
                          {Math.abs(r.days)} дн.
                        </span>
                      </div>
                    ))}
                    {overdueReminders.length > 5 && (
                      <Link href="/reminders" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1 pl-4">
                        и ещё {overdueReminders.length - 5}
                        <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {(tripsWithoutDriver.length > 0 || tripsWithoutTruck.length > 0) && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-2">
                    Рейсы без назначения · {tripsWithoutDriver.length + tripsWithoutTruck.length}
                  </div>
                  <div className="space-y-1.5">
                    {tripsWithoutDriver.slice(0, 3).map((t) => (
                      <Link
                        key={`nd-${t.id}`}
                        href={`/trips/${t.id}`}
                        className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">№{t.trip_number || '—'} · {pickName(t.clients) || '—'}</span>
                        <span className="ml-auto text-xs text-amber-600 whitespace-nowrap">
                          нет водителя
                        </span>
                      </Link>
                    ))}
                    {tripsWithoutTruck.slice(0, 3).map((t) => (
                      <Link
                        key={`nt-${t.id}`}
                        href={`/trips/${t.id}`}
                        className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">№{t.trip_number || '—'} · {pickName(t.clients) || '—'}</span>
                        <span className="ml-auto text-xs text-amber-600 whitespace-nowrap">
                          нет машины
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
                            {tripsWithoutSalary.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-2">
                    Завершённые рейсы без ЗП · {tripsWithoutSalary.length}
                  </div>
                  <div className="space-y-1.5">
                    {tripsWithoutSalary.slice(0, 5).map((t) => (
                      <Link
                        key={`ns-${t.id}`}
                        href={`/trips/${t.id}`}
                        className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">
                          №{t.trip_number || '—'}
                          {t.clientName && ` · ${t.clientName}`}
                          {t.driverName && ` · ${t.driverName}`}
                        </span>
                        <span className="ml-auto text-xs text-amber-600 whitespace-nowrap">
                          нет ЗП
                        </span>
                      </Link>
                    ))}
                    {tripsWithoutSalary.length > 5 && (
                      <div className="text-xs text-slate-400 text-center pt-1">
                        и ещё {tripsWithoutSalary.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
  );
}
