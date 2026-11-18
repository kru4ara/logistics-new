'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Shuffle } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { redistributeTransaction } from '../bank/actions';

/** «Разнести заново»: приход по заказам — по свежим счетам, остаток останется авансом. */
export default function RedistributeButton({ txId }: { txId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="flex flex-col items-start md:items-end gap-0.5 shrink-0">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await redistributeTransaction(txId);
            setMsg(r.message ? { ok: r.ok, text: r.message } : null);
            router.refresh();
          })
        }
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />}
        {t('pay2.redistribute')}
      </button>
      {msg && <span className={`text-[11px] max-w-xs ${msg.ok ? 'text-slate-500' : 'text-red-600'}`}>{msg.text}</span>}
    </span>
  );
}
