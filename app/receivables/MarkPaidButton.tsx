'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { markTripPaid } from './actions';

export default function MarkPaidButton({ tripId, tripNumber }: { tripId: string; tripNumber: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(t('recv.markConfirm', { n: tripNumber }))) return;
        startTransition(async () => {
          const res = await markTripPaid(tripId);
          if (!res.ok && res.message) alert(res.message);
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 whitespace-nowrap"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.2} />}
      {isPending ? t('recv.marking') : t('recv.markPaid')}
    </button>
  );
}
