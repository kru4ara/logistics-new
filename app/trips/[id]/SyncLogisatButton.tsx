'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Result = {
  success: boolean;
  error?: string;
  distanceKm?: number;
  fuelLiters?: number;
  consumption?: number;
  framesCount?: number;
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

      // ⚠️ СНАЧАЛА читаем текст, потом пытаемся парсить как JSON
      const text = await res.text();

      let data: Result;
      try {
        data = JSON.parse(text);
      } catch {
        // Сервер вернул не JSON (HTML страница ошибки)
        const isHtml = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html');
        setResult({
          success: false,
          error: isHtml
            ? `Сервер вернул HTML вместо JSON (код ${res.status}). Endpoint /api/logisat/sync не найден или упал с ошибкой.`
            : `Неверный ответ сервера (код ${res.status}): ${text.slice(0, 200)}`,
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
        <span>📡</span>
        <span>Logisat</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
             onClick={() => !isPending && setIsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
               onClick={(e) => e.stopPropagation()}>

            {isPending || !result ? (
              <div className="text-center py-6">
                <div className="inline-block w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <div className="mt-4 text-slate-600 font-medium">Запрашиваем данные из Logisat...</div>
                <div className="mt-2 text-xs text-slate-400">Обычно 2-10 секунд</div>
              </div>
            ) : result.success ? (
              <>
                <div className="text-center">
                  <div className="text-5xl mb-2">✅</div>
                  <h3 className="text-lg font-bold text-slate-900">Данные обновлены</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400 font-medium mb-1">Пробег</div>
                    <div className="text-2xl font-bold text-slate-900">{result.distanceKm}</div>
                    <div className="text-xs text-slate-500">км</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 text-center">
                    <div className="text-xs text-slate-400 font-medium mb-1">Топливо</div>
                    <div className="text-2xl font-bold text-slate-900">{result.fuelLiters}</div>
                    <div className="text-xs text-slate-500">л</div>
                  </div>
                </div>
                {result.consumption !== undefined && result.consumption > 0 && (
                  <div className="text-center text-sm text-slate-600">
                    Средний расход: <b className="text-slate-800">{result.consumption} л/100км</b>
                  </div>
                )}
                <div className="text-center text-xs text-slate-400">
                  {result.framesCount} кадров GPS
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-5xl mb-2">❌</div>
                  <h3 className="text-lg font-bold text-slate-900">Не удалось</h3>
                </div>
                <div className="text-sm text-slate-700 bg-red-50 border border-red-200 rounded-xl p-3 break-words">
                  {result.error}
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-all"
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
