'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle } from 'lucide-react';

export default function CopyBlock({
  text,
  phone,
}: {
  text: string;
  phone?: string | null;
}) {
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

  // Генерируем ссылку на WhatsApp (убираем всё, кроме цифр)
  const waPhone = phone ? phone.replace(/\D/g, '') : null;
  const waLink = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`
    : null;

  return (
    <div className="card overflow-hidden">
      <div className="p-4 md:p-5 border-b border-slate-100 flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
          <Copy className="w-5 h-5 text-brand-600" strokeWidth={2} />
          Задание для водителя
        </h2>
        <div className="flex items-center gap-2">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold
                         bg-emerald-600 hover:bg-emerald-700 text-white
                         transition-all duration-150 active:scale-[0.98]"
            >
              <MessageCircle className="w-4 h-4" strokeWidth={2.5} />
              WhatsApp
            </a>
          )}
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
      </div>
      <pre className="p-4 md:p-5 text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
{text}
      </pre>
    </div>
  );
}
