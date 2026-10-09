'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  RadioTower,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

type Result = {
  success: boolean;
  error?: string;
  distanceKm?: number;
  fuelLiters?: number;
  consumption?: number;
  framesCount?: number;
  truck?: string;
  deviceId?: string | null;
};

export default function SyncLogisatButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function handleSync() {
    setResult(null);
    setIsOpen(true);

    try {
      const res = await fetch('/api/logisat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId }),
      });

      const text = await res.text();

      let data: Result;
      try {
        data = JSON.parse(text);
      } catch {
        setResult({
          success: false,
          error: `Сервер вернул не-JSON (код ${res.status}): ${text.slice(0, 200)}`,
        });
        return;
      }

      setResult(data);

      if (data.success) {
        setTimeout(() => {
          startTransition(() => router.refresh());
          setIsOpen(false);
        }, 1500);
      }
    } catch (err) {
      setResult({ success: false, error: (err as Error).message });
    }
  }

  const hasDistance = result?.distanceKm != null;
  const hasFuel = result?.fuelLiters != null;

  return (
    <>
      <button
        type="button"
        onClick={handleSync}
        disabled={isPending}
        className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-emerald-300 text-emerald-700
                   bg-emerald-50 hover:bg-emerald-100 font-medium text-sm transition-all
                   disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-1.5"
      >
        <RadioTower className="w-4 h-4" />
        <span>Logisat</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => !isPending && setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-soft-lg max-w-md w-full p-6 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {isPending || !result ? (
              <div className="text-center py-6">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                <div className="mt-4 text-slate-600 font-medium">Запрашиваем данные из Logisat...</div>
                <div className="mt-2 text-xs text-slate-400">Обычно 2-10 секунд</div>
              </div>
            ) : result.success ? (
              <>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Данные обновлены</h3>
                  {result.truck && (
                    <div className="text-xs text-slate-400 mt-1">
                      {result.truck} · {result.framesCount} кадров GPS
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400 font-medium mb-1">Пробег</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {hasDistance ? result.distanceKm : '—'}
                    </div>
                    <div className="text-xs text-slate-500">км</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400 font-medium mb-1">Топливо</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {hasFuel ? result.fuelLiters : '—'}
                    </div>
                    <div className="text-xs text-slate-500">л</div>
                  </div>
                </div>
                {result.consumption !== undefined && result.consumption > 0 && (
                  <div className="text-center text-sm text-slate-600">
                    Средний расход: <b className="text-slate-800">{result.consumption} л/100км</b>
                  </div>
                )}
                {!hasDistance && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Одометр не передаёт данные — пробег не рассчитан</span>
                  </div>
                )}
                {!hasFuel && (
                  <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Датчик топлива не передаёт данные</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-50 text-red-600 mb-3">
                    <XCircle className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Не удалось</h3>
                </div>
                <div className="text-sm text-slate-700 bg-red-50 border border-red-200 rounded-xl p-3 break-words">
                  {result.error}
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary w-full"
                >
                  Закрыть
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
