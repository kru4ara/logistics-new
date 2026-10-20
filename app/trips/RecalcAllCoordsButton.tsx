'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2 } from 'lucide-react';
import { recalcAllTripsCoords } from '../trip-actions';

export default function RecalcAllCoordsButton({ tripIds }: { tripIds: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleClick() {
    if (tripIds.length === 0) {
      alert('Нет рейсов для пересчёта (пустой список)');
      return;
    }
    const confirmed = confirm(
      `Пересчитать координаты для ${tripIds.length} рейсов?\n\n` +
      `Это может занять до ${tripIds.length * 2} секунд (геокодинг).`
    );
    if (!confirmed) return;

    setResult(null);
    startTransition(async () => {
      const res = await recalcAllTripsCoords(tripIds);
      if (!res.success) {
        setResult(`Ошибка: ${res.error}`);
        alert(`Ошибка: ${res.error}`);
        return;
      }
      setResult(`Обновлено: ${res.updated}, не удалось: ${res.failed}`);
      router.refresh();
    });
  }

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
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
        ) : (
          <MapPin className="w-4 h-4" strokeWidth={2.2} />
        )}
        {isPending ? 'Пересчёт…' : 'Пересчитать координаты'}
      </button>
      {result && (
        <div className="text-xs text-slate-500">{result}</div>
      )}
    </div>
  );
}
