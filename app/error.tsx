'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useT } from './components/I18nProvider';
import { reportClientError } from '../lib/report-client-error';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();
  useEffect(() => {
    // После нового деплоя у открытой вкладки старые id server actions — Next
    // отвечает «Server Action … was not found». Это не сбой: перезагружаем
    // страницу один раз (метка в sessionStorage не даёт зациклиться).
    if (/Server Action .* was not found/i.test(error.message)) {
      try {
        const key = 'stale-action-reload';
        const last = Number(sessionStorage.getItem(key)) || 0;
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        /* без sessionStorage — покажем обычный экран ошибки */
      }
    }
    // Логируем в Vercel → Functions → Runtime Logs
    console.error('[app/error]', error.message, error.digest);
    // С digest — ошибка сервера, её уже отправил instrumentation.ts; без digest — браузерная.
    if (!error.digest) reportClientError(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 text-center">
        <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-600" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          {t('toast.error')}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          {t('err.hint')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all active:scale-[0.98]"
          >
            {t('err.retry')}
          </button>
          <Link
            href="/"
            className="flex-1 px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-all text-center"
          >
            {t('err.home')}
          </Link>
        </div>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-4">
            {t('err.code')}{' '}<b>{error.digest}</b>
          </p>
        )}
      </div>
    </main>
  );
}
