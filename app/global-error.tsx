'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error]', error.message, error.digest);
  }, [error]);

  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <main style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '16px',
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚨</div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>
              Критическая ошибка
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              Приложение не смогло загрузиться. Попробуйте перезагрузить страницу.
            </p>
            <button
              onClick={reset}
              style={{
                width: '100%',
                padding: '12px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              🔄 Перезагрузить
            </button>
            {error.digest && (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '16px' }}>
                Код ошибки: <b>{error.digest}</b>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
