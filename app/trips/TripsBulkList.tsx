'use client';

import { useState, useSyncExternalStore, useTransition } from 'react';
import { useT } from '../components/I18nProvider';
import { formatDate } from '../../lib/i18n/format';
import { tPlural } from '../../lib/i18n/translate';
import { tripStatusKey } from '../../lib/i18n/labels';
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
  Clock,
  Truck as TruckIcon,
  LayoutGrid,
  List,
} from 'lucide-react';
import { bulkSetStatus, bulkDelete } from './bulk-actions';
import { formatEur } from '../../lib/i18n/format';
import { confirmDialog } from '../components/Dialogs';

export type TripCardData = {
  id: string;
  trip_number: string | null;
  status: string;
  route: string | null;
  start_date: string | null;
  end_date: string | null;
  client_request_number: string | null;
  profit_mode: 'trip' | 'forwarding';
  revenue_eur: number | null;
  expenses: number;
  clientName: string;
  driverName: string | null;
  /** Нет даты выгрузки — заказ в пути, в статистику не идёт. */
  missingUnloadDate?: boolean;
  /** Сборный рейс: ведущий заказ или заказ в его машине. */
  group?: { role: 'leader' | 'member'; n: number } | null;
};

export type MonthGroup = {
  key: string;
  title: string;
  isNoDate: boolean;
  trips: TripCardData[];
  revenue: number;
  expenses: number;
};


const VIEW_KEY = 'trips.view';
const VIEW_EVENT = 'trips-view';
function readView(): 'cards' | 'table' {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}
function subscribeView(cb: () => void) {
  window.addEventListener(VIEW_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(VIEW_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// «Завершён» массово не ставится: нужна дата финиша (bulk-actions.ts).
const STATUS_OPTIONS = ['planned', 'active', 'invoiced', 'paid'] as const;

const statusColors: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-brand-50 text-brand-700 border-brand-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const statusStripColors: Record<string, string> = {
  planned: 'bg-slate-300',
  active: 'bg-brand-500',
  completed: 'bg-green-500',
  invoiced: 'bg-yellow-500',
  paid: 'bg-emerald-500',
};

export default function TripsBulkList({
  tripsInTransit,
  tripsWithoutDate,
  monthGroups,
  isSearchMode,
  flatMode = false,
}: {
  tripsInTransit: TripCardData[];
  tripsWithoutDate: TripCardData[];
  monthGroups: MonthGroup[];
  isSearchMode: boolean;
  flatMode?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const statusText = (st: string) => {
    const key = tripStatusKey(st);
    return key ? t(key) : st;
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Вид списка: карточки (по умолчанию, телефон) или таблица (плотно, с компьютера).
  // Вид списка: карточки (по умолчанию, телефон) или таблица (плотно, с компьютера).
  // Хранится в localStorage; на сервере и до гидратации — карточки.
  const view = useSyncExternalStore<'cards' | 'table'>(
    subscribeView,
    () => readView(),
    () => 'cards',
  );
  const changeView = (v: 'cards' | 'table') => {
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* приватный режим — вид просто не запомнится */
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  };

  const allIds = [
    ...tripsInTransit.map((t) => t.id),
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
        setError(res.error || t('trips.error'));
        return;
      }
      clearSelection();
      router.refresh();
    });
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    const count = tPlural(t, locale, 'plural.trip', selected.size);
    if (!(await confirmDialog(t('trips.confirmDelete', { count }), { danger: true }))) return;
    setError(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkDelete(ids);
      if (!res.success) {
        setError(res.error || t('trips.error'));
        return;
      }
      clearSelection();
      router.refresh();
    });
  }

  function TripCard({ trip }: { trip: TripCardData }) {
    const isSelected = selected.has(trip.id);
    const tripProfit = (trip.revenue_eur || 0) - trip.expenses;
    const hasNumber = trip.trip_number != null;

    return (
      <div
        className={`group card card-hover overflow-hidden relative active:scale-[0.99]
          ${isSelected ? 'ring-2 ring-brand-500 border-brand-300' : ''}`}
      >
        <Link
          href={`/trips/${trip.id}`}
          prefetch={false}
          className="absolute inset-0 z-0"
          aria-label={hasNumber ? t('trips.openOrder', { number: String(trip.trip_number) }) : t('trips.openRequest')}
        />

        <div className={`h-1.5 ${statusStripColors[trip.status] || 'bg-slate-300'}`} />

        <div className="p-4 md:p-5 pointer-events-none relative">
          <button
            type="button"
            onClick={() => toggle(trip.id)}
            aria-label={isSelected ? t('trips.deselect') : t('trips.select')}
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
              {hasNumber ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium tabular-nums">
                    {trip.profit_mode === 'forwarding' ? t('trips.kindForwarding') : t('trips.kindTrip')} № {trip.trip_number}
                  </span>
                  {trip.profit_mode === 'forwarding' && (
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200">
                      {t('trips.kindForwardingShort')}
                    </span>
                  )}
                  {trip.group && (
                    <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {trip.group.role === 'leader' ? t('group.badgeLeader', { n: trip.group.n }) : t('group.badgeMember')}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs font-medium inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <Clock className="w-3 h-3" strokeWidth={2.2} />
                  {t('trips.noNumberRequest')}
                </div>
              )}
              <div className="text-base md:text-lg font-bold text-slate-900 mt-0.5 break-words">
                {trip.clientName}
              </div>
            </div>
            <span className={`shrink-0 px-2 py-1 rounded-full text-[10px] md:text-xs font-semibold border whitespace-nowrap
                              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusText(trip.status)}
            </span>
          </div>

          {trip.missingUnloadDate && (
            <div className="flex items-center gap-1.5 text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 mb-2">
              <Clock className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
              <span>{t('trips.noUnloadDate')}</span>
            </div>
          )}

          {trip.client_request_number && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 break-words">
              <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
              <span>{t('trips.request')} <b className="text-slate-700">{trip.client_request_number}</b></span>
            </div>
          )}

          <div className="flex items-start gap-1.5 text-sm text-slate-600 mb-2">
            <RouteIcon className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" strokeWidth={2} />
            <span className="break-words">{trip.route || '—'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2">
            <span className="flex items-center gap-1 text-slate-500">
              <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
              {t('trips.start')} <b className="text-slate-700 tabular-nums">{formatDate(trip.start_date, locale)}</b>
            </span>
            {trip.end_date ? (
              <span className="text-emerald-700 tabular-nums">
                {t('trips.finish')} <b>{formatDate(trip.end_date, locale)}</b>
              </span>
            ) : (
              <span className="text-slate-400">{t('trips.finishNone')}</span>
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
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{t('trips.freight')}</div>
              <div className="text-sm font-bold text-slate-900 break-words tabular-nums">
                {trip.revenue_eur ? `${formatEur(trip.revenue_eur, 'auto')}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{t('trips.expenses')}</div>
              <div className="text-sm font-bold text-red-500 break-words tabular-nums">
                {formatEur(trip.expenses)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{t('trips.profit')}</div>
              <div className={`text-sm font-bold break-words tabular-nums ${tripProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatEur(tripProfit)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderGrid(trips: TripCardData[]) {
    const cards = (
      <div className={`grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3 ${view === 'table' ? 'md:hidden' : ''}`}>
        {trips.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}
      </div>
    );
    if (view !== 'table') return cards;
    return (
      <>
        {cards}
        <div className="hidden md:block card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2 font-medium">№</th>
                <th className="px-3 py-2 font-medium">{t('trips.colClient')}</th>
                <th className="px-3 py-2 font-medium">{t('trips.colRoute')}</th>
                <th className="px-3 py-2 font-medium">{t('trips.start')}</th>
                <th className="px-3 py-2 font-medium">{t('trips.finish')}</th>
                <th className="px-3 py-2 font-medium">{t('trips.status')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('trips.freight')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('trips.expenses')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('trips.profit')}</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => {
                const profit = (trip.revenue_eur || 0) - trip.expenses;
                const isSel = selected.has(trip.id);
                return (
                  <tr
                    key={trip.id}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest('button,a')) router.push(`/trips/${trip.id}`);
                    }}
                    className={`border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50 ${isSel ? 'bg-brand-50/60' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(trip.id)}
                        aria-label={isSel ? t('trips.deselect') : t('trips.select')}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSel ? 'bg-brand-600 border-brand-600' : 'border-slate-300 hover:border-brand-400'}`}
                      >
                        {isSel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </button>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Link href={`/trips/${trip.id}`} prefetch={false} className="font-semibold text-slate-900 hover:text-brand-700 tabular-nums">
                        {trip.trip_number ?? '—'}
                      </Link>
                      {trip.profit_mode === 'forwarding' && (
                        <span className="ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-violet-50 text-violet-700">{t('trips.kindForwardingShort')}</span>
                      )}
                      {trip.group && (
                        <span className="ml-1.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-indigo-50 text-indigo-700">
                          {trip.group.role === 'leader' ? t('group.badgeLeader', { n: trip.group.n }) : t('group.badgeMember')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate font-medium text-slate-800" title={trip.clientName}>{trip.clientName}</td>
                    <td className="px-3 py-2 max-w-[280px] truncate text-slate-600" title={trip.route ?? ''}>{trip.route || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-600">{formatDate(trip.start_date, locale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-slate-600">{trip.end_date ? formatDate(trip.end_date, locale) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {statusText(trip.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{trip.revenue_eur ? formatEur(trip.revenue_eur) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-600">{formatEur(trip.expenses)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatEur(profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const sectionTitle = flatMode ? t('trips.recentlyCreated') : t('trips.noNumberNew');
  const sectionSubtitle = flatMode
    ? t('trips.records', { n: tripsWithoutDate.length })
    : t('trips.requestsWaiting', { n: tripsWithoutDate.length });

  return (
    <>
      <div className="hidden md:flex justify-end -mb-2">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label={t('trips.view')}>
          {(['cards', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => changeView(v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${view === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {v === 'cards' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
              {t(v === 'cards' ? 'trips.viewCards' : 'trips.viewTable')}
            </button>
          ))}
        </div>
      </div>

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
                  {t('trips.selected', { n: selected.size, total: allIds.length })}
                </div>
                <div className="flex flex-wrap gap-3 mt-0.5">
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={selected.size === allIds.length || isPending}
                    className="text-xs text-brand-600 hover:underline font-medium disabled:text-slate-300 disabled:no-underline"
                  >
                    {t('trips.selectAll')}
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={isPending}
                    className="text-xs text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" strokeWidth={2.5} />
                    {t('trips.clear')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:shrink-0">
              <details className="relative">
                <summary
                  className={`btn btn-secondary text-sm cursor-pointer list-none inline-flex items-center gap-2
                    ${isPending ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <RefreshCw className="w-4 h-4" strokeWidth={2.2} />
                  {t('trips.status')}
                  <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                </summary>
                <div className="absolute right-0 top-full mt-1 card border-slate-200 shadow-soft-lg p-1.5 min-w-[200px] z-40">
                  {STATUS_OPTIONS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSetStatus(st)}
                      disabled={isPending}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700
                                 hover:bg-brand-50 hover:text-brand-700 transition-colors
                                 disabled:opacity-50 flex items-center gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full ${statusStripColors[st]}`} />
                      {statusText(st)}
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
                {t('trips.delete')}
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

      {/* СЕКЦИЯ «В ПУТИ» — заказы без даты выгрузки, самый верх */}
      {tripsInTransit.length > 0 && !isSearchMode && !flatMode && (
        <div>
          <div className="flex items-center gap-3 mb-3 md:mb-4 px-1">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <TruckIcon className="w-4 h-4 md:w-5 md:h-5 text-brand-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">{t('trips.inTransit')}</h2>
              <div className="text-xs text-slate-400">
                {t('trips.inTransitHint', { n: tripsInTransit.length })}
              </div>
            </div>
          </div>
          {renderGrid(tripsInTransit)}
        </div>
      )}

      {/* СЕКЦИЯ БЕЗ НОМЕРА / НОВЫЕ ЗАЯВКИ (или плоский список) */}
      {tripsWithoutDate.length > 0 && (!isSearchMode || flatMode) && (
        <div>
          <div className="flex items-center gap-3 mb-3 md:mb-4 px-1">
            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0
              ${flatMode ? 'bg-brand-50' : 'bg-amber-50'}`}>
              {flatMode ? (
                <Calendar className="w-4 h-4 md:w-5 md:h-5 text-brand-600" strokeWidth={2} />
              ) : (
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-amber-600" strokeWidth={2} />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">{sectionTitle}</h2>
              <div className="text-xs text-slate-400">{sectionSubtitle}</div>
            </div>
          </div>
          {renderGrid(tripsWithoutDate)}
        </div>
      )}

      {/* ПО МЕСЯЦАМ */}
      <div className="space-y-6 md:space-y-8">
        {monthGroups.map((g) => {
          const monthProfit = g.revenue - g.expenses;
          return (
            <div key={g.key} className="animate-slide-up">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 md:w-5 md:h-5 text-brand-600" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900">{g.title}</h2>
                    <div className="text-xs text-slate-400">{t('trips.tripsCount', { n: g.trips.length })}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-right">
                  <div>
                    <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">{t('trips.freight')}</div>
                    <div className="text-sm md:text-base font-bold text-green-600 tabular-nums">
                      {formatEur(g.revenue)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">{t('trips.expenses')}</div>
                    <div className="text-sm md:text-base font-bold text-red-500 tabular-nums">
                      {formatEur(g.expenses)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-xs uppercase text-slate-400 font-medium">{t('trips.profit')}</div>
                    <div className={`text-sm md:text-base font-bold tabular-nums ${monthProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatEur(monthProfit)}
                    </div>
                  </div>
                </div>
              </div>
              {renderGrid(g.trips)}
            </div>
          );
        })}
      </div>
    </>
  );
}
