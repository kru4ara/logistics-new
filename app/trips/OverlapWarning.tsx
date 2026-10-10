'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

type Conflict = {
  id: string;
  trip_number: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  route: string | null;
  client_name: string;
};

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

export default function OverlapWarning({
  truckId,
  startDate,
  endDate,
  excludeTripId,
}: {
  truckId: string;
  startDate: string;
  endDate: string;
  excludeTripId?: string;
}) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Нет тягача или даты старта — проверять нечего
    if (!truckId || !startDate) {
      setConflicts([]);
      setHasChecked(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          truckId,
          startDate,
        });
        if (endDate) params.set('endDate', endDate);
        if (excludeTripId) params.set('excludeTripId', excludeTripId);

        const res = await fetch(`/api/trips/check-overlap?${params.toString()}`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (cancelled) return;

        if (data.success) {
          setConflicts(data.conflicts || []);
          setHasChecked(true);
        } else {
          setConflicts([]);
          setHasChecked(false);
        }
      } catch {
        if (!cancelled) {
          setConflicts([]);
          setHasChecked(false);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 350); // debounce 350ms

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [truckId, startDate, endDate, excludeTripId]);

  // Ничего не показываем, если проверка не производилась
  if (!hasChecked && !isLoading) return null;

  // Загрузка
  if (isLoading && conflicts.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>Проверяю пересечения…</span>
      </div>
    );
  }

  // Всё чисто
  if (conflicts.length === 0) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-emerald-600">
        <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.2} />
        <span>Машина свободна на этот период</span>
      </div>
    );
  }

  // Есть пересечения
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 animate-fade-in">
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-amber-800">
            Машина уже занята на этот период
          </div>
          <div className="text-xs text-amber-700 mt-0.5">
            {conflicts.length === 1
              ? 'Найдено пересечение с одним рейсом'
              : `Найдено пересечений: ${conflicts.length}`}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 mt-2">
        {conflicts.slice(0, 5).map((c) => (
          <Link
            key={c.id}
            href={`/trips/${c.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start justify-between gap-2 p-2 rounded-lg bg-white/60 hover:bg-white border border-amber-100 hover:border-amber-300 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                <span className="tabular-nums">№ {c.trip_number || '—'}</span>
                <span className="text-slate-400 font-normal">·</span>
                <span className="text-slate-600 font-normal truncate">
                  {c.client_name || 'Клиент не указан'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                {' · '}
                <span className="text-slate-400">{statusLabels[c.status] || c.status}</span>
              </div>
            </div>
            <ExternalLink
              className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600 shrink-0 mt-0.5 transition-colors"
              strokeWidth={2.2}
            />
          </Link>
        ))}
        {conflicts.length > 5 && (
          <div className="text-[11px] text-amber-700 pl-2">
            …и ещё {conflicts.length - 5}
          </div>
        )}
      </div>

      <div className="text-[11px] text-amber-700 mt-3 pl-2 border-l-2 border-amber-300">
        Можно сохранить, но проверьте — возможно, машина уже назначена на другой рейс.
      </div>
    </div>
  );
}
