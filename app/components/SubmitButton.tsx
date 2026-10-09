'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  pendingText?: string;
  className?: string;
};

/**
 * Универсальная submit-кнопка для форм с server actions.
 * Автоматически блокируется и показывает «Сохранение…», пока форма в pending.
 *
 * ВАЖНО: должна быть РЕБЁНКОМ <form>, не обёрткой. useFormStatus
 * читает статус родительской формы и вне неё не работает.
 */
export default function SubmitButton({
  children = 'Сохранить',
  pendingText = 'Сохранение…',
  className,
}: Props) {
  const { pending } = useFormStatus();

  const baseClass =
    className ??
    'w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-brand hover:shadow-brand-lg transition-all duration-150 active:scale-[0.98]';

  return (
    <button type="submit" disabled={pending} className={baseClass}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
