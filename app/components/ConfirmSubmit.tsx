'use client';

import type { ReactNode } from 'react';

/** Кнопка отправки формы с подтверждением (удаление, отключение доступа). */
export default function ConfirmSubmit({ message, className, title, children }: { message: string; className?: string; title?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
