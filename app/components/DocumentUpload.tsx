'use client';

import { useState, useTransition, useRef } from 'react';
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

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

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
          resetInputs();
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

      {/* Тип документа + срок */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-3">
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Срок действия"
        />
      </div>

      {/* Скрытые inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="hidden"
      />

      {/* Кнопки выбора источника */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     bg-blue-600 hover:bg-blue-700 text-white font-semibold
                     shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all text-sm"
        >
          <span className="text-lg">📸</span>
          <span>Сфотографировать</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                     border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-50 active:scale-[0.98] transition-all text-sm"
        >
          <span className="text-lg">🖼</span>
          <span>Выбрать файл</span>
        </button>
      </div>

      {file && (
        <div className="mt-3 text-xs text-slate-500">
          Выбран: <b className="text-slate-700">{file.name}</b>
          {' · '}
          {(file.size / 1024 / 1024).toFixed(2)} МБ
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isPending}
        className="mt-3 w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
      >
        {isPending ? '⏳ Загрузка…' : '📤 Загрузить документ'}
      </button>

      {status && (
        <p className={`mt-3 text-sm ${status.startsWith('Ошибка') ? 'text-red-600' : 'text-emerald-600'}`}>
          {status}
        </p>
      )}
    </div>
  );
}
