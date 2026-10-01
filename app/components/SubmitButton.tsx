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
 * Автоматически блокируется и показывает «⏳ …», пока форма в pending.
 *
 * ВАЖНО: должна быть РЕБЁНКОМ <form>, не обёрткой. useFormStatus
 * читает статус родительской формы и вне неё не работает.
 */
export default function SubmitButton({
  children = 'Сохранить',
  pendingText = '⏳ Сохранение…',
  className,
}: Props) {
  const { pending } = useFormStatus();

  const baseClass =
    className ??
    'w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]';

  return (
    <button type="submit" disabled={pending} className={baseClass}>
      {pending ? pendingText : children}
    </button>
  );
}
