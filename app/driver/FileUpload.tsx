'use client';

import { useState, useRef } from 'react';
import { uploadDocument } from './upload-actions';

// Максимальный размер файла (из-за лимитов Vercel Serverless = 4.5 MB)
const MAX_FILE_SIZE_MB = 4;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Разрешённые типы
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'pdf'];
const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export default function FileUpload({ tripId }: { tripId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) {
    setStatus('');
    setStatusType('idle');

    if (!f) {
      setFile(null);
      return;
    }

    // Проверка размера
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setStatus(`❌ Файл больше ${MAX_FILE_SIZE_MB} МБ (${(f.size / 1024 / 1024).toFixed(2)} МБ). Сожмите или выберите другой.`);
      setStatusType('error');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Проверка расширения
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIMES.includes(f.type)) {
      setStatus(`❌ Неподдерживаемый формат. Разрешены: JPG, PNG, HEIC, PDF`);
      setStatusType('error');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setFile(f);
  }

  async function handleUpload() {
    if (!file || isUploading) return;

    setIsUploading(true);
    setStatus('Загрузка...');
    setStatusType('loading');

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
      });

      const result = await uploadDocument(tripId, 'cmr', base64Data, file.name);

      if (result.success) {
        setStatus('✅ ' + result.message);
        setStatusType('success');
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        setTimeout(() => {
          setStatus('');
          setStatusType('idle');
        }, 5000);
      } else {
        setStatus('❌ ' + result.message);
        setStatusType('error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setStatus('❌ ' + msg);
      setStatusType('error');
    } finally {
      setIsUploading(false);
    }
  }

  const statusClass =
    statusType === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    statusType === 'error' ? 'text-red-700 bg-red-50 border-red-200' :
    statusType === 'loading' ? 'text-blue-700 bg-blue-50 border-blue-200' :
    'hidden';

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        accept="image/*,application/pdf"
        className="block w-full text-sm text-slate-600
                   file:mr-4 file:py-2.5 file:px-4
                   file:rounded-lg file:border-0
                   file:text-sm file:font-semibold
                   file:bg-blue-50 file:text-blue-700
                   hover:file:bg-blue-100
                   file:cursor-pointer cursor-pointer
                   border border-slate-200 rounded-lg p-1"
      />

      {file && (
        <div className="text-xs text-slate-500 px-1">
          Выбран: <b className="text-slate-700">{file.name}</b>
          {' · '}
          {(file.size / 1024 / 1024).toFixed(2)} МБ
        </div>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || isUploading}
        className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-all
          ${!file || isUploading
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-[0.98]'
          }`}
      >
        {isUploading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Загрузка...
          </>
        ) : (
          <>📸 Загрузить CMR</>
        )}
      </button>

      {status && (
        <div className={`px-4 py-3 rounded-xl border text-sm font-medium ${statusClass}`}>
          {status}
        </div>
      )}

      <p className="text-xs text-slate-400 px-1">
        Максимум: <b>{MAX_FILE_SIZE_MB} МБ</b> · Форматы: JPG, PNG, HEIC, PDF
      </p>
    </div>
  );
}
