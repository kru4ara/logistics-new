'use client';

import { useState } from 'react';

export default function TelegramLinkCard({
  driverId,
  isConnected,
}: {
  driverId: string;
  isConnected: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const link = `https://t.me/raibuilding_bot?start=${driverId}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Не удалось скопировать. Скопируйте вручную:\n\n' + link);
    }
  }

  if (isConnected) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          📱 Telegram-уведомления
        </h2>
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <span className="text-lg">✅</span>
          <span className="font-medium">
            Водитель подключён и получает уведомления о новых рейсах
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
        📱 Telegram-уведомления
      </h2>

      <p className="text-sm text-slate-500 mb-4">
        Водитель пока не подключён. Отправьте ему эту ссылку в WhatsApp или SMS —
        он нажмёт её, а затем «Start» в Telegram. После этого он будет получать
        уведомления о новых рейсах автоматически.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5
                     text-sm text-slate-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleCopy}
          className={`px-4 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap transition-all active:scale-[0.98]
            ${copied
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'}`}
        >
          {copied ? '✅ Скопировано' : '📋 Копировать'}
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        Ссылка персональная. Если перешлёте её другому человеку — подключится он, а не водитель.
      </div>
    </div>
  );
}
