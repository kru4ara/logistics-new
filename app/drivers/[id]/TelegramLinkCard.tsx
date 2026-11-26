'use client';

import { useState } from 'react';
import { MessageCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import { createDriverTelegramLink } from './telegram-link-actions';
import { useT } from '../../components/I18nProvider';
import { notify } from '../../components/Dialogs';

export default function TelegramLinkCard({
  driverId,
  isConnected,
}: {
  driverId: string;
  isConnected: boolean;
}) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Ссылка одноразовая и создаётся по кнопке: в ней случайный токен,
  // а не driver_id (см. миграцию 20261113_017).
  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const res = await createDriverTelegramLink(driverId);
      if (res.link) setLink(res.link);
      else setError(res.error || t('drvCard.linkFailed'));
    } catch {
      setError(t('drvCard.linkFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify(t('drvCard.copyFailed', { link: link ?? '' }), 'error');
    }
  }

  if (isConnected) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-brand-600" />
          {t('drvCard.tgTitle')}
        </h2>
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-medium">
            {t('drvCard.tgConnected')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-brand-600" />
        {t('drvCard.tgTitle')}
      </h2>

      <p className="text-sm text-slate-500 mb-4">
        {t('drvCard.tgNotConnected')}
      </p>

      {!link ? (
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-brand transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? t('drvCard.creating') : t('drvCard.createLink')}
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="input flex-1 font-mono text-sm bg-slate-50"
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`px-4 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap transition-all active:scale-[0.98]
              flex items-center justify-center gap-2
              ${copied
                ? 'bg-emerald-600 text-white'
                : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand'}`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                {t('shared.copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t('drvCard.copy')}
              </>
            )}
          </button>
        </div>
      )}

      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

      <div className="mt-3 text-xs text-slate-400">
        {t('drvCard.linkHint')}
      </div>
    </div>
  );
}
