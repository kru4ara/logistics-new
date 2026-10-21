'use client';

import { useState } from 'react';
import { Pencil, GitMerge } from 'lucide-react';
import MergeContractorDialog from './MergeContractorDialog';

type Option = { id: string; label: string };

export default function ContractorCardActions({
  contractorId,
  contractorName,
  otherContractors,
}: {
  contractorId: string;
  contractorName: string;
  otherContractors: Option[];
}) {
  const [isMergeOpen, setIsMergeOpen] = useState(false);

  return (
    <>
      <a
        href={`/contractors/${contractorId}/edit`}
        className="flex-1 inline-flex items-center justify-center gap-1.5 text-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
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

      {isMergeOpen && (
        <MergeContractorDialog
          sourceId={contractorId}
          sourceName={contractorName}
          otherContractors={otherContractors}
          onClose={() => setIsMergeOpen(false)}
        />
      )}
    </>
  );
}
