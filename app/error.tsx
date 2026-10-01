'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Логируем в Vercel → Functions → Runtime Logs
    console.error('[app/error]', error.message, error.digest);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 text-center">
        <div className="text-5xl mb-3">⚠️</div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Что-то пошло не так
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Попробуйте обновить страницу или вернуться на главную. Если ошибка повторяется — сообщите в офис.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={reset}
            className="flex-1 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all active:scale-[0.98]"
          >
            🔄 Попробовать снова
          </button>
          <a
            href="/"
            className="flex-1 px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 transition-all text-center"
          >
            🏠 На главную
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-slate-400 mt-4">
            Код ошибки: <b>{error.digest}</b>
          </p>
        )}
      </div>
    </main>
  );
}
