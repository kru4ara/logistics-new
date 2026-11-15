'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { syncInvoicesNow } from './actions';

/** «Сверить с Fakturowo» — оплаты, сроки и номера KSeF из сервиса фактур. */
export default function SyncInvoicesButton({ provider }: { provider: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-col items-start md:items-end gap-1">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await syncInvoicesNow();
            setMsg({ ok: r.ok, text: r.message });
            router.refresh();
          })
        }
        className="btn btn-secondary text-sm disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {t('recv.sync', { provider })}
      </button>
      {msg && <p className={`text-xs max-w-md ${msg.ok ? 'text-slate-600' : 'text-red-600'}`}>{msg.text}</p>}
      <p className="text-[11px] text-slate-400">{t('recv.syncAuto')}</p>
    </div>
  );
}
