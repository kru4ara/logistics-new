import { AlertTriangle } from 'lucide-react';
import type { ReminderItem } from '../../../lib/dashboard/reminders';

type Props = {
  expired: ReminderItem[];
  soon: ReminderItem[];
};

/** Блок «Требует внимания»: просроченные и приближающиеся напоминания. */
export default function DashboardAttention({ expired, soon }: Props) {
  if (expired.length === 0 && soon.length === 0) return null;

  return (
          <div className="card border-l-4 border-l-amber-500 p-4 md:p-5 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={2.2} />
                Требует внимания
              </h2>
              <a
                href="/reminders"
                className="text-sm text-brand-600 hover:underline font-medium whitespace-nowrap self-start sm:self-auto"
              >
                Все напоминания →
              </a>
            </div>

            <div className="space-y-3">
              {expired.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-red-600 font-semibold mb-1.5">
                    Просрочено · {expired.length}
                  </div>
                  <div className="space-y-1">
                    {expired.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="truncate">{r.title}</span>
                        <span className="ml-auto text-xs text-red-600 whitespace-nowrap tabular-nums">
                          {Math.abs(r.days)} дн.
                        </span>
                      </div>
                    ))}
                    {expired.length > 3 && (
                      <div className="text-xs text-slate-400 pl-4">
                        ...и ещё {expired.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {soon.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-1.5">
                    Скоро (≤7 дней) · {soon.length}
                  </div>
                  <div className="space-y-1">
                    {soon.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">{r.title}</span>
                        <span className="ml-auto text-xs text-amber-600 whitespace-nowrap tabular-nums">
                          {r.days} дн.
                        </span>
                      </div>
                    ))}
                    {soon.length > 3 && (
                      <div className="text-xs text-slate-400 pl-4">
                        ...и ещё {soon.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
  );
}
