'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadDocument } from '../document-actions';

export default function DocumentUpload({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('passport');
  const [expiryDate, setExpiryDate] = useState('');
  const [status, setStatus] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleUpload() {
    if (!file || isPending) return;
    setStatus('Загрузка...');

    const formData = new FormData();
    formData.set('entityType', entityType);
    formData.set('entityId', entityId);
    formData.set('documentType', documentType);
    formData.set('expiryDate', expiryDate);
    formData.set('file', file);

    startTransition(async () => {
      try {
        const res = await uploadDocument(formData);
        if (res.success) {
          setStatus('Документ загружен!');
          setFile(null);
          setExpiryDate('');
          router.refresh();
        } else {
          setStatus('Ошибка: ' + res.error);
        }
      } catch (e) {
        setStatus('Ошибка: ' + (e as Error).message);
      }
    });
  }

  return (
    <div className="p-5 border border-slate-200 rounded-2xl bg-white">
      <h3 className="text-base font-bold text-slate-900 mb-3">📎 Загрузить документ</h3>

      <div className="flex flex-wrap gap-3">
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="passport">Паспорт</option>
          <option value="visa">Виза</option>
          <option value="license">Водительское удостоверение</option>
          <option value="tachograph_card">Карта водителя</option>
          <option value="code95">Код 95</option>
          <option value="adr">АДР</option>
          <option value="insurance">Страховка</option>
          <option value="tech_passport">Техпаспорт</option>
          <option value="border_insurance">Пограничная страховка</option>
          <option value="tachograph_legalization">Легализация тахографа</option>
          <option value="other">Другое</option>
        </select>

        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mt-3">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept="image/*,application/pdf"
          className="text-sm text-slate-700"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || isPending}
        className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all active:scale-[0.98]"
      >
        {isPending ? '⏳ Загрузка…' : 'Загрузить'}
      </button>

      {status && (
        <p className={`mt-3 text-sm ${status.startsWith('Ошибка') ? 'text-red-600' : 'text-emerald-600'}`}>
          {status}
        </p>
      )}
    </div>
  );
}
