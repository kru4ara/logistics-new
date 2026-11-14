'use client';

import { useEffect } from 'react';
import { reportClientError } from '../../lib/report-client-error';

/** Ошибки вне рендера (обработчики событий, промисы) → Telegram владельца. Ничего не рисует. */
export default function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
