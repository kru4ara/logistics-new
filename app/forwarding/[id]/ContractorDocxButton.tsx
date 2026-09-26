'use client';

import { useState } from 'react';

export default function ContractorDocxButton({
  forwardingId,
  contractorId,
  contractorName,
}: {
  forwardingId: string;
  contractorId: string;
  contractorName: string;
}) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleDownload() {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const url = `/api/forwarding/${forwardingId}/contractor/${contractorId}/docx`;
      const res = await fetch(url);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Ошибка' }));
        alert(`❌ ${err.error || 'Не удалось сгенерировать'}`);
        return;
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Zlecenie_${contractorName.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      alert(`❌ ${(e as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isLoading}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
        ${isLoading
          ? 'bg-slate-100 text-slate-400 cursor-wait'
          : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 active:scale-[0.97]'}`}
    >
      {isLoading ? (
        <>
          <span className="inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Генерация...
        </>
      ) : (
        <>🖨 Заявка DOCX</>
      )}
    </button>
  );
}
