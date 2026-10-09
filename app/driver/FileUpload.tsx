'use client';

import { useState, useRef } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
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

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File | null) {
    setStatus('');
    setStatusType('idle');

    if (!f) {
      setFile(null);
      return;
    }

    // Проверка размера
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setStatus(`Файл больше ${MAX_FILE_SIZE_MB} МБ (${(f.size / 1024 / 1024).toFixed(2)} МБ). Сожмите или выберите другой.`);
      setStatusType('error');
      setFile(null);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Проверка расширения
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIMES.includes(f.type)) {
      setStatus('Неподдерживаемый формат. Разрешены: JPG, PNG, HEIC, PDF');
      setStatusType('error');
      setFile(null);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(f);
  }

  function resetInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        setStatus(result.message);
        setStatusType('success');
        setFile(null);
        resetInputs();
        setTimeout(() => {
          setStatus('');
          setStatusType('idle');
        }, 5000);
      } else {
        setStatus(result.message);
        setStatusType('error');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      setStatus(msg);
      setStatusType('error');
    } finally {
      setIsUploading(false);
    }
  }

  const statusClass =
    statusType === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    statusType === 'error' ? 'text-red-700 bg-red-50 border-red-200' :
    statusType === 'loading' ? 'text-brand-700 bg-brand-50 border-brand-200' :
    'hidden';

  const StatusIcon =
    statusType === 'success' ? CheckCircle2 :
    statusType === 'error' ? XCircle :
    Loader2;

  return (
    <div className="space-y-3">

      {/* Скрытые inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        className="hidden"
      />

      {/* Две кнопки: камера (только на мобильном) + выбор файла */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="md:hidden w-full flex items-center justify-center gap-2 px-5 py-4 rounded-xl
                     bg-brand-600 hover:bg-brand-700 text-white font-semibold
                     shadow-brand active:scale-[0.98] transition-all text-base"
        >
          <Camera className="w-5 h-5" />
          <span>Сфотографировать</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                     border border-slate-300 text-slate-700 font-semibold
                     hover:bg-slate-50 active:scale-[0.98] transition-all"
        >
          <ImageIcon className="w-5 h-5" />
          <span>Выбрать файл</span>
        </button>
      </div>

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
            <Loader2 className="w-4 h-4 animate-spin" />
            Загрузка...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Загрузить CMR
          </>
        )}
      </button>

      {status && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm font-medium animate-fade-in ${statusClass}`}>
          <StatusIcon className={`w-4 h-4 shrink-0 mt-0.5 ${statusType === 'loading' ? 'animate-spin' : ''}`} />
          <span>{status}</span>
        </div>
      )}

      <p className="text-xs text-slate-400 px-1">
        Максимум: <b>{MAX_FILE_SIZE_MB} МБ</b> · Форматы: JPG, PNG, HEIC, PDF
      </p>
    </div>
  );
}
