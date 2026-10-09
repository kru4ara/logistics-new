'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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
    <div className="card overflow-hidden">
      <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Copy className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Задание для водителя
        </h2>
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold
                     transition-all duration-150 active:scale-[0.98] ${
                       copied
                         ? 'bg-emerald-500 text-white'
                         : 'btn btn-primary py-2'
                     }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" strokeWidth={2.5} />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" strokeWidth={2.5} />
              Скопировать
            </>
          )}
        </button>
      </div>
      <pre className="p-4 md:p-5 text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
{text}
      </pre>
    </div>
  );
}
