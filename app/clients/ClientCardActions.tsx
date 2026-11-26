'use client';

import { useState } from 'react';
import { Pencil, Trash2, GitMerge } from 'lucide-react';
import MergeClientDialog from './MergeClientDialog';
import { useT } from '../components/I18nProvider';
import { confirmDialog } from '../components/Dialogs';

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
  const { t } = useT();
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
          {t('trip.change')}
        </a>
        <button
          type="button"
          onClick={() => setIsMergeOpen(true)}
          title={t('dir.merge')}
          aria-label={t('dir.merge')}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-600 hover:bg-white hover:text-brand-700 transition-all"
        >
          <GitMerge className="w-4 h-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await confirmDialog(t('dir.deleteClientConfirm', { name: clientName }), { danger: true })) onDelete();
          }}
          title={t('trips.delete')}
          aria-label={t('trips.delete')}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all"
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
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
