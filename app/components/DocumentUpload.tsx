'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { uploadDocument } from '../document-actions';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Paperclip,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

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
    setStatus('uploading');

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
          setStatus('success');
          setFile(null);
          setExpiryDate('');
          resetInputs();
          router.refresh();
          setTimeout(() => setStatus(''), 3000);
        } else {
          setStatus('error:' + res.error);
        }
      } catch (e) {
        setStatus('error:' + (e as Error).message);
      }
    });
  }

  const isError = status.startsWith('error:');
  const errorText = isError ? status.slice(6) : '';

  return (
    <div className="border border-slate-200 rounded-2xl bg-white p-4 md:p-5">
      <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
        <Paperclip className="w-5 h-5 text-brand-600" strokeWidth={2} />
        Загрузить документ
      </h3>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 mb-3">
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="input text-sm"
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
          className="input text-sm"
          placeholder="Срок действия"
        />
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="btn btn-primary w-full text-sm py-3 justify-center"
        >
          <Camera className="w-4 h-4" strokeWidth={2.2} />
          Сфотографировать
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-secondary w-full text-sm py-3 justify-center"
        >
          <ImageIcon className="w-4 h-4" strokeWidth={2.2} />
          Выбрать файл
        </button>
      </div>

      {file && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Paperclip className="w-3.5 h-3.5 shrink-0 text-slate-400" strokeWidth={2} />
          <span className="truncate">
            <b className="text-slate-700">{file.name}</b>
            {' · '}
            {(file.size / 1024 / 1024).toFixed(2)} МБ
          </span>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || isPending}
        className="btn btn-primary mt-3 w-full sm:w-auto px-5 py-3 text-sm justify-center"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
            Загрузка…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" strokeWidth={2.5} />
            Загрузить документ
          </>
        )}
      </button>

      {status === 'success' && (
        <p className="mt-3 text-sm text-emerald-600 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
          Документ загружен
        </p>
      )}

      {isError && (
        <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5">
          <XCircle className="w-4 h-4" strokeWidth={2.5} />
          {errorText}
        </p>
      )}
    </div>
  );
}
