'use client';

import { useState } from 'react';

export default function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Ошибка копирования:', e);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">📋 Задание для водителя</h2>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                     transition-all duration-150 active:scale-[0.98] ${
                       copied
                         ? 'bg-emerald-500 text-white'
                         : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'
                     }`}
        >
          <span>{copied ? '✅' : '📋'}</span>
          <span>{copied ? 'Скопировано' : 'Скопировать'}</span>
        </button>
      </div>
      <pre className="p-5 text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
{text}
      </pre>
    </div>
  );
}
