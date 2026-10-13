'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

export default function SegmentDriverDocxButton({
  tripId,
  segmentId,
  driverName,
  segmentPosition,
}: {
  tripId: string;
  segmentId: string;
  driverName: string;
  segmentPosition: number;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleDownload() {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const url = `/api/trips/${tripId}/segment/${segmentId}/driver-docx?t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка' }));
        alert(`${err.error || 'Не удалось сгенерировать'}`);
        return;
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const safe = (driverName || 'driver').replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `Zadanie_${segmentPosition}_${safe}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      alert(`${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isLoading}
      title="Скачать задание водителю (DOCX)"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
        ${isLoading
          ? 'bg-slate-100 text-slate-400 cursor-wait'
          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 active:scale-[0.97]'}`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          Генерация...
        </>
      ) : (
        <>
          <Download className="w-3 h-3" strokeWidth={2.2} />
          Задание
        </>
      )}
    </button>
  );
}
