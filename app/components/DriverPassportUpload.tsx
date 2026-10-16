'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2 } from 'lucide-react';
import { replaceDriverPassport } from '../driver-actions';

export default function DriverPassportUpload({
  driverId,
  hasPhoto,
}: {
  driverId: string;
  hasPhoto: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const formData = new FormData();
    formData.set('driver_id', driverId);
    formData.set('file', file);

    startTransition(async () => {
      const res = await replaceDriverPassport(formData);
      if (res.success) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-brand-600 transition-colors disabled:opacity-50 mt-2"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.2} />
        ) : (
          <Camera className="w-3.5 h-3.5" strokeWidth={2.2} />
        )}
        {hasPhoto ? 'Сменить фото' : 'Добавить фото'}
      </button>
      {error && (
        <div className="text-[10px] text-red-500 mt-1">{error}</div>
      )}
    </>
  );
}
