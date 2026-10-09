'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Route as RouteIcon,
  Calendar,
  UserCircle,
  Check,
  Trash2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';
import { bulkSetStatus, bulkDelete } from './bulk-actions';

export type TripCardData = {
  id: string;
  trip_number: number | null;
  status: string;
  route: string | null;
  start_date: string | null;
  end_date: string | null;
  client_request_number: string | null;
  revenue_eur: number | null;
  expenses: number;
  clientName: string;
  driverName: string | null;
};

export type MonthGroup = {
  key: string;
  title: string;
  isNoDate: boolean;
  trips: TripCardData[];
  revenue: number;
  expenses: number;
};

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Планируется' },
  { value: 'active', label: 'В пути' },
  { value: 'invoiced', label: 'Выставлен счёт' },
  { value: 'paid', label: 'Оплачен' },
];

const statusColors: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-brand-50 text-brand-700 border-brand-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

const statusStripColors: Record<string, string> = {
  planned: 'bg-slate-300',
  active: 'bg-brand-500',
  completed: 'bg-green-500',
  invoiced: 'bg-yellow-500',
  paid: 'bg-emerald-500',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

export default function TripsBulkList({
  tripsWithoutDate,
  monthGroups,
  isSearchMode,
}: {
  tripsWithoutDate: TripCardData[];
  monthGroups: MonthGroup[];
  isSearchMode: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allIds = [
    ...tripsWithoutDate.map((t) => t.id),
    ...monthGroups.flatMap((g) => g.trips.map((t) => t.id)),
  ];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setError(null);
  }

  function clearSelection() {
    setSelected(new Set());
    setError(null);
  }

  function selectAll() {
    setSelected(new Set(allIds));
    setError(null);
  }

  function handleSetStatus(status: string) {
    if (selected.size === 0) return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkSetStatus(ids, status);
      if (!res.success) {
        setError(res.error || 'Ошибка');
        return;
      }
      clearSelection();
      router.refresh();
    });
  }

  function handleDelete() {
    if (selected.size === 0) return;
    const word =
      selected.size === 1 ? 'рейс' : selected.size < 5 ? 'рейса' : 'рейсов';
    if (!confirm(`Удалить ${selected.size} ${word}? Это действие нельзя отменить.`)) return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkDelete(ids);
      if (!res.success) {
        setError(res.error || 'Ошибка');
        return;
      }
      clearSelection();
      router.refresh();
    });
  }

  function TripCard({ trip }: { trip: TripCardData }) {
    const isSelected = selected.has(trip.id);
    const tripProfit = (trip.revenue_eur || 0) - trip.expenses;

    return (
      <div
        className={`group card card-hover overflow-hidden relative active:scale-[0.99]
          ${isSelected ? 'ring-2 ring-brand-500 border-brand-300' : ''}`}
      >
        {/* Ссылка на всю площадь карточки */}
        <Link
          href={`/trips/${trip.id}`}
          className="absolute inset-0 z-0"
          aria-label={`Открыть рейс № ${trip.trip_number || ''}`}
        />

        <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />

        {/* Контент — pointer-events-none, чтобы клики шли на Link */}
        <div className="p-4 md:p-5 pointer-events-none relative">
          {/* Чекбокс — поверх всего, кликабельный */}
          <button
            type="button"
            onClick={() => toggle(trip.id)}
            aria-label={isSelected ? 'Снять выделение' : 'Выделить рейс'}
            className={`pointer-events-auto absolute top-4 right-4 md:top-5 md:right-5 z-10
              w-6 h-6 rounded-md border-2 flex items-center justify-center
              transition-all active:scale-90
              ${isSelected
                ? 'bg-brand-600 border-brand-600 shadow-brand'
                : 'bg-white/90 backdrop-blur-sm border-slate-300 hover:border-brand-400'}`}
          >
            {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
          </button>

          <div className="flex items-start justify-between gap-2 mb-3 pr-8">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400 font-medium tabular-nums">
                № {trip.trip_number || '—'}
              </div>
              <div className="text-base md:text-lg font-bold text-slate-900 mt-0.5 break-words">
                {trip.clientName}
              </div>
            </div>
            <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          {trip.client_request_number && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 break-words">
              <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
              <span>Заявка: <b className="text-slate-700">{trip.client_request_number}</b></span>
            </div>
          )}

          <div className="flex items-start gap-1.5 text-sm text-slate-600 mb-2">
            <RouteIcon className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" strokeWidth={2} />
            <span className="break-words">{trip.route || '—'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
            <span className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
              Старт: <b className="text-slate-700 tabular-nums">{fmtDate(trip.start_date)}</b>
            </span>
            {trip.end_date ? (
              <span className="text-emerald-700 tabular-nums">
                Финиш: <b>{fmtDate(trip.end_date)}</b>
              </span>
            ) : (
              <span className="text-slate-400">Финиш: —</span>
            )}
          </div>

          {trip.driverName && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4 truncate">
              <UserCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{trip.driverName}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Фрахт</div>
              <div className="text-sm font-bold text-slate-900 break-words tabular-nums">
                {trip.revenue_eur ? `${trip.revenue_eur} €` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Расходы</div>
              <div className="text-sm font-bold text-red-500 break-words tabular-nums">
                {trip.expenses.toFixed(0)} €
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Прибыль</div>
              <div className={`text-sm font-bold break-words tabular-nums ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {tripProfit.toFixed(0)} €
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* STICKY TOOLBAR */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-30 card border-brand-300 shadow-brand-lg p-3 md:p-4 animate-slide-down">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold shrink-0 tabular-nums shadow-brand">
                {selected.size}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-sm">
                  Выбрано: {selected.size} из {allIds.length}
                </div>
                <div className="flex flex-wrap gap-3 mt-0.5">
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={selected.size === allIds.length || isPending}
                    className="text-xs text-brand-600 hover:underline font-medium disabled:text-slate-300 disabled:no-underline"
                  >
                    Выбрать все
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={isPending}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" strokeWidth={2.5} />
                    Снять
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:shrink-0">
              {/* Меню смены статуса */}
              <details className="relative">
                <summary
                  className={`btn btn-secondary text-sm cursor-pointer list-none inline-flex items-center gap-2
                    ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <RefreshCw className="w-4 h-4" strokeWidth={2.2} />
                  Статус
                  <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                </summary>
                <div className="absolute right-0 top-full mt-1 card border-slate-200 shadow-soft-lg p-1.5 min-w-[200px] z-40">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSetStatus(s.value)}
                      disabled={isPending}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700
                                 hover:bg-brand-50 hover:text-brand-700 transition-colors
                                 disabled:opacity-50 flex items-center gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full ${statusStripColors[s.value]}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </details>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="btn btn-danger text-sm inline-flex items-center gap-2"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" strokeWidth={2.2} />
                )}
                Удалить
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* БЕЗ ДАТЫ СТАРТА */}
      {!isSearchMode && tripsWithoutDate.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3 md:mb-4 px-1">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-amber-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">Без даты старта</h2>
              <div className="text-xs text-slate-400">
                Рейсов: {tripsWithoutDate.length} · черновики, ждут назначения машины/даты
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {tripsWithoutDate.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        </div>
      )}

      {/* ПО МЕСЯЦАМ */}
      <div className="space-y-6 md:space-y-8">
        {monthGroups.map((g) => {
          const monthProfit = g.revenue - g.expenses;
          const IconComponent = g.isNoDate ? FileText : Calendar;
          const iconBg = g.isNoDate ? 'bg-amber-50' : 'bg-brand-50';
          const iconColor = g.isNoDate ? 'text-amber-600' : 'text-brand-600';

          return (
            <div key={g.key} className="animate-slide-up">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4 px-1">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                    <IconComponent className={`w-4 h-4 md:w-5 md:h-5 ${iconColor}`} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900">{g.title}</h2>
                    <div className="text-xs text-slate-400">Рейсов: {g.trips.length}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right">
                  <div>
                    <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Фрахт</div>
                    <div className="text-sm md:text-base font-bold text-green-600 tabular-nums">
                      {g.revenue.toFixed(0)} €
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Расходы</div>
                    <div className="text-sm md:text-base font-bold text-red-500 tabular-nums">
                      {g.expenses.toFixed(0)} €
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">Прибыль</div>
                    <div className={`text-sm md:text-base font-bold tabular-nums ${monthProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {monthProfit.toFixed(0)} €
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
                {g.trips.map((t) => (
                  <TripCard key={t.id} trip={t} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
