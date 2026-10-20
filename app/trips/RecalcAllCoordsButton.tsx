'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2 } from 'lucide-react';
import { recalcAllTripsCoords } from '../trip-actions';

const BATCH_SIZE = 20;

export default function RecalcAllCoordsButton({ tripIds }: { tripIds: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (tripIds.length === 0) {
      alert('Нет рейсов для пересчёта (пустой список)');
      return;
    }

    const confirmed = confirm(
      `Пересчитать координаты для ${tripIds.length} рейсов?\n\n` +
      `Это может занять до ${Math.ceil(tripIds.length * 2)} секунд (геокодинг). ` +
      `Обработка идёт порциями по ${BATCH_SIZE}.`
    );
    if (!confirmed) return;

    setError(null);
    setProgress({ done: 0, total: tripIds.length, failed: 0 });

    startTransition(async () => {
      let done = 0;
      let failed = 0;

      for (let i = 0; i < tripIds.length; i += BATCH_SIZE) {
        const batch = tripIds.slice(i, i + BATCH_SIZE);

        try {
          const res = await recalcAllTripsCoords(batch);
          if (!res.success) {
            setError(res.error || 'Ошибка');
            break;
          }
          done += batch.length;
          failed += res.failed;
          setProgress({ done, total: tripIds.length, failed });
        } catch (e) {
          setError((e as Error).message || 'Ошибка');
          break;
        }
      }

      // После завершения — обновляем страницу
      router.refresh();
    });
  }

  const isRunning = isPending || (progress != null && progress.done < progress.total && !error);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white
                   hover:bg-slate-50 font-medium text-sm transition-all disabled:opacity-50 active:scale-[0.98]"
        title="Пересчитать координаты для всех рейсов в списке"
      >
        {isRunning ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
        ) : (
          <MapPin className="w-4 h-4" strokeWidth={2.2} />
        )}
        {isRunning ? 'Пересчёт…' : 'Пересчитать координаты'}
      </button>

      {progress && (
        <div className="text-xs text-slate-500">
          {error
            ? <span className="text-red-600">{error}</span>
            : progress.done < progress.total
              ? <>Обработано {progress.done} из {progress.total}…</>
              : <>Готово: {progress.total - progress.failed} из {progress.total}{progress.failed > 0 ? `, ошибок: ${progress.failed}` : ''}</>
          }
        </div>
      )}
    </div>
  );
}
