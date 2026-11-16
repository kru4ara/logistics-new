'use client';

import type { ReactNode } from 'react';

/** Кнопка отправки формы с подтверждением (отключение доступа). */
export default function ConfirmSubmit({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
