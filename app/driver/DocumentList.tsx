'use client';

import { useState, useTransition } from 'react';
import { deleteDocument } from './upload-actions';
import {
  FileText,
  ExternalLink,
  Trash2,
  Check,
  Inbox,
  AlertCircle,
} from 'lucide-react';

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
      <div className="text-center py-8">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center">
          <Inbox className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
        </div>
        <div className="text-slate-400 text-sm">Файлы ещё не загружены</div>
      </div>
    );
  }

  function handleDelete(id: string, name: string) {
    if (confirmId !== id) {
      setConfirmId(id);
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
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
          <span>{error}</span>
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
                : 'border-slate-100 hover:border-brand-200 hover:bg-brand-50/30'}`}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-brand-600" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-slate-800 truncate text-sm">
                  {doc.original_name || doc.document_type || 'Документ'}
                </div>
                <div className="text-xs text-slate-400 tabular-nums">
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
                  className="inline-flex items-center gap-1.5 text-brand-600 hover:bg-brand-50 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.2} />
                  Открыть
                </a>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id, doc.original_name || '')}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap
                    ${isConfirming
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'text-red-600 hover:bg-red-50'}
                    ${isPending ? 'cursor-wait' : ''}`}
                >
                  {isConfirming ? (
                    <>
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      Точно?
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                      Удалить
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
