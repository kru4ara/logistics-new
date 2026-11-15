'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Copy, Loader2, Ban, RefreshCw, Check } from 'lucide-react';
import { useT } from '../components/I18nProvider';
import { createPortalLink, revokePortalLink } from './portal-actions';

type Props = { clientId: string; active: { createdAt: string; lastSeen: string | null } | null };

/** Портал клиента: создать ссылку (видна один раз), перевыпустить, отключить. */
export default function PortalLinkBlock({ clientId, active }: Props) {
  const { t } = useT();
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const create = () =>
    start(async () => {
      setError(null);
      const r = await createPortalLink(clientId);
      if (!r.ok) setError(r.message ?? null);
      else setUrl(r.url ?? null);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Globe className="w-4 h-4 text-brand-600" />
        {t('portalAdm.title')}
      </h3>
      <p className="text-xs text-slate-500">{t('portalAdm.hint')}</p>

      {url ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
          <div className="text-xs text-emerald-800">{t('portalAdm.onceHint')}</div>
          <div className="flex items-center gap-2">
            <input readOnly value={url} className="input text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-secondary text-xs px-2.5 py-1.5"
              onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {t(copied ? 'portalAdm.copied' : 'portalAdm.copy')}
            </button>
          </div>
        </div>
      ) : active ? (
        <div className="text-sm text-slate-700">
          {t('portalAdm.active', { date: new Date(active.createdAt).toLocaleDateString() })}
          {' · '}
          {active.lastSeen ? t('portalAdm.lastSeen', { date: new Date(active.lastSeen).toLocaleString() }) : t('portalAdm.neverSeen')}
        </div>
      ) : (
        <div className="text-sm text-slate-500">{t('portalAdm.none')}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isPending} onClick={() => {
          if (active && !window.confirm(t('portalAdm.reissueConfirm'))) return;
          create();
        }} className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : active ? <RefreshCw className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
          {t(active ? 'portalAdm.reissue' : 'portalAdm.create')}
        </button>
        {active && (
          <button type="button" disabled={isPending} onClick={() => {
            if (!window.confirm(t('portalAdm.revokeConfirm'))) return;
            start(async () => {
              const r = await revokePortalLink(clientId);
              if (!r.ok) setError(r.message ?? null);
              setUrl(null);
              router.refresh();
            });
          }} className="btn btn-secondary text-xs px-3 py-1.5 text-red-600 disabled:opacity-50">
            <Ban className="w-3.5 h-3.5" />
            {t('portalAdm.revoke')}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
