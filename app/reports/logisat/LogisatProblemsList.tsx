'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  Truck,
  XCircle,
  AlertTriangle,
  Gauge,
  Fuel,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RadioTower,
  type LucideIcon,
} from 'lucide-react';

export type TripRow = {
  id: string;
  trip_number: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  actual_km: number | null;
  actual_liters: number | null;
  logisat_synced_at: string | null;
  truck_id: string | null;
  truck_reg: string | null;
  client_name: string | null;
};

type Variant = 'active-never' | 'archive-never' | 'stale' | 'no-odometer' | 'no-fuel';

const VARIANT_META: Record<Variant, {
  title: string;
  Icon: LucideIcon;
  iconColor: string;
  badgeColor: string;
  emptyText: string;
  cardHint: string;
}> = {
  'active-never': {
    title: 'Активные — синк не выполнялся',
    Icon: AlertTriangle,
    iconColor: 'text-red-500',
    badgeColor: 'bg-red-100 text-red-700',
    emptyText: 'Все активные рейсы синхронизированы',
    cardHint: 'Активный рейс без единого синка — жми «Синкать все» или открой и нажми «Logisat»',
  },
  'archive-never': {
    title: 'Архив — синк не выполнялся',
    Icon: XCircle,
    iconColor: 'text-slate-400',
    badgeColor: 'bg-slate-100 text-slate-600',
    emptyText: 'В архиве нет рейсов без синка',
    cardHint: 'Рейс завершён без единого синка — данные телеметрии утеряны',
  },
  'stale': {
    title: 'Синк устарел',
    Icon: Clock,
    iconColor: 'text-amber-500',
    badgeColor: 'bg-amber-100 text-amber-700',
    emptyText: 'Активные рейсы синкаются свежими данными',
    cardHint: 'Давно не обновлялся — обнови вручную в карточке рейса',
  },
  'no-odometer': {
    title: 'Одометр не передаёт данные',
    Icon: Gauge,
    iconColor: 'text-orange-500',
    badgeColor: 'bg-orange-100 text-orange-700',
    emptyText: 'Одометр везде передаёт данные',
    cardHint: 'Пробег пустой — проверь CAN-модуль на машине',
  },
  'no-fuel': {
    title: 'Топливо не передаёт данные',
    Icon: Fuel,
    iconColor: 'text-red-400',
    badgeColor: 'bg-red-100 text-red-700',
    emptyText: 'Датчик топлива везде работает',
    cardHint: 'Датчик топлива молчит — проверь CAN-модуль',
  },
};

const INITIAL_VISIBLE = 9;

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

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

function daysAgo(d: string | null): number | null {
  if (!d) return null;
  const diff = Date.now() - new Date(d).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

type SyncBulkResponse = {
  success: boolean;
  total?: number;
  okCount?: number;
  failCount?: number;
  error?: string;
};

export default function LogisatProblemsList({
  variant,
  items,
  bulkSyncable = false,
}: {
  variant: Variant;
  items: TripRow[];
  bulkSyncable?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(variant !== 'archive-never');
  const [showAll, setShowAll] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  const meta = VARIANT_META[variant];
  const Icon = meta.Icon;

  const visibleItems = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const hiddenCount = Math.max(0, items.length - INITIAL_VISIBLE);

  function handleBulkSync() {
    const activeIds = items.map((t) => t.id);
    if (activeIds.length === 0) return;
    const word = activeIds.length === 1 ? 'рейс' : activeIds.length < 5 ? 'рейса' : 'рейсов';
    if (!confirm(`Синхронизировать ${activeIds.length} ${word} с Logisat?`)) return;

    setBulkStatus('Синхронизация…');
    startTransition(async () => {
      try {
        const res = await fetch('/api/logisat/sync-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tripIds: activeIds }),
        });
        const data: SyncBulkResponse = await res.json();

        if (!data.success) {
          setBulkStatus(`Ошибка: ${data.error || 'неизвестная'}`);
          return;
        }

        const ok = data.okCount || 0;
        const fail = data.failCount || 0;
        if (fail === 0) {
          setBulkStatus(`Готово: синхронизировано ${ok} из ${data.total}`);
        } else {
          setBulkStatus(`Готово: ${ok} успешно, ${fail} с ошибкой`);
        }

        setTimeout(() => setBulkStatus(null), 6000);
        router.refresh();
      } catch (e) {
        setBulkStatus(`Ошибка: ${(e as Error).message}`);
      }
    });
  }

  function TripCard({ trip }: { trip: TripRow }) {
    const syncedAgo = daysAgo(trip.logisat_synced_at);
    return (
      <Link
        href={`/trips/${trip.id}`}
        className="group block card card-hover overflow-hidden active:scale-[0.99]"
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400 font-medium tabular-nums">
                № {trip.trip_number || '—'}
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 break-words group-hover:text-brand-600 transition-colors">
                {trip.client_name || 'Клиент не указан'}
              </div>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap
              ${statusColors[trip.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
              {statusLabels[trip.status] || trip.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-2">
            {trip.truck_reg && (
              <span className="inline-flex items-center gap-1">
                <Truck className="w-3 h-3" strokeWidth={2} />
                <b className="text-slate-700">{trip.truck_reg}</b>
              </span>
            )}
            <span className="tabular-nums">
              {fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" strokeWidth={2} />
              {trip.logisat_synced_at
                ? `синк ${syncedAgo !== null ? `${syncedAgo} дн. назад` : '—'}`
                : 'синка не было'}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  // Пустая секция
  if (items.length === 0) {
    return (
      <div className="card p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" strokeWidth={1.8} />
        </div>
        <div className="text-sm text-slate-500">{meta.emptyText}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Заголовок секции */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-2 text-left group"
        >
          <Icon className={`w-5 h-5 ${meta.iconColor} shrink-0`} strokeWidth={2.2} />
          <span className="text-base md:text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
            {meta.title}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium tabular-nums ${meta.badgeColor}`}>
            {items.length}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" strokeWidth={2.5} />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" strokeWidth={2.5} />
          )}
        </button>

        {/* Кнопка массовой синхронизации — только для активных */}
        {bulkSyncable && (
          <button
            type="button"
            onClick={handleBulkSync}
            disabled={isPending}
            className="btn btn-primary text-sm inline-flex items-center gap-2"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RadioTower className="w-4 h-4" strokeWidth={2.2} />
            )}
            Синкать все ({items.length})
          </button>
        )}
      </div>

      {/* Статус bulk-синка */}
      {bulkStatus && (
        <div className="mb-3 text-xs text-slate-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 inline-flex items-center gap-2 animate-fade-in">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
          <span>{bulkStatus}</span>
        </div>
      )}

      {/* Список */}
      {isExpanded && (
        <>
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600
                         font-medium text-sm hover:bg-white hover:border-brand-300 hover:text-brand-600
                         transition-all active:scale-[0.99] inline-flex items-center justify-center gap-2"
            >
              {showAll ? (
                <>
                  <ChevronUp className="w-4 h-4" strokeWidth={2.5} />
                  Свернуть
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
                  Показать все ({items.length})
                </>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
