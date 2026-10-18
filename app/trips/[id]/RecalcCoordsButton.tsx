'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { recalcTripCoords } from '../../trip-actions';

export default function RecalcCoordsButton({ tripId }: { tripId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await recalcTripCoords(tripId);
      if (res.success) {
        router.refresh();
      } else {
        alert(`Ошибка: ${res.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors disabled:opacity-50"
      title="Пересчитать координаты из крайних сегментов"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.2} />
      ) : (
        <MapPin className="w-3.5 h-3.5" strokeWidth={2.2} />
      )}
      {isPending ? 'Пересчёт…' : 'Пересчитать координаты'}
    </button>
  );
}
