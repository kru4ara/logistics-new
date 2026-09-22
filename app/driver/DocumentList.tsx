'use client';

import { useState, useTransition } from 'react';
import { deleteDocument } from './upload-actions';

type Doc = {
  id: string;
  document_type: string | null;
  file_path: string | null;
  original_name: string | null;
  uploaded_at: string | null;
  expiry_date?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function DocumentList({
  documents,
  tripId,
  canDelete = true,
}: {
  documents: Doc[];
  tripId: string;
  canDelete?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <div className="text-slate-400 text-sm text-center py-6">
        Файлы ещё не загружены
      </div>
    );
  }

  function handleDelete(id: string, name: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      // Авто-отмена подтверждения через 4 сек
      setTimeout(() => {
        setConfirmId((prev) => (prev === id ? null : prev));
      }, 4000);
      return;
    }

    setConfirmId(null);
    setError(null);

    startTransition(async () => {
      const res = await deleteDocument(id, tripId);
      if (!res.success) {
        setError(res.message);
      }
    });
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          ❌ {error}
        </div>
      )}

      {documents.map((doc) => {
        const fileUrl = doc.file_path
          ? `${supabaseUrl}/storage/v1/object/public/documents/${doc.file_path}`
          : null;

        const isConfirming = confirmId === doc.id;

        return (
          <div
            key={doc.id}
            className={`flex justify-between items-center border rounded-xl p-3 gap-3 transition-all
              ${isPending ? 'opacity-60' : ''}
              ${isConfirming
                ? 'border-red-300 bg-red-50'
                : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-xl shrink-0">📄</span>
              <div className="min-w-0">
                <div className="font-medium text-slate-800 truncate text-sm">
                  {doc.original_name || doc.document_type || 'Документ'}
                </div>
                <div className="text-xs text-slate-400">
                  {doc.uploaded_at
                    ? new Date(doc.uploaded_at).toLocaleDateString('ru-RU')
                    : '—'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:bg-blue-50 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  Открыть
                </a>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id, doc.original_name || '')}
                  disabled={isPending}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap
                    ${isConfirming
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'text-red-600 hover:bg-red-50'}
                    ${isPending ? 'cursor-wait' : ''}`}
                >
                  {isConfirming ? '✓ Точно?' : '🗑'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
