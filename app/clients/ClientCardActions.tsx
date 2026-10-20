'use client';

import { useState } from 'react';
import { Pencil, Trash2, GitMerge } from 'lucide-react';
import MergeClientDialog from './MergeClientDialog';

type Option = { id: string; label: string };

export default function ClientCardActions({
  clientId,
  clientName,
  otherClients,
  onDelete,
}: {
  clientId: string;
  clientName: string;
  otherClients: Option[];
  onDelete: () => void;
}) {
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  return (
    <>
      <div className="p-3 border-t border-slate-100 bg-slate-50/40 flex gap-2">
        <a
          href={`/clients/${clientId}/edit`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                     hover:bg-white transition-all"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
          Изменить
        </a>
        <button
          type="button"
          onClick={() => setIsMergeOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-brand-300 text-brand-700
                     text-xs font-medium hover:bg-brand-50 transition-all"
        >
          <GitMerge className="w-3.5 h-3.5" strokeWidth={2} />
          Объединить
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                     text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          Удалить
        </button>
      </div>

      {isMergeOpen && (
        <MergeClientDialog
          sourceId={clientId}
          sourceName={clientName}
          otherClients={otherClients}
          onClose={() => setIsMergeOpen(false)}
        />
      )}
    </>
  );
}
