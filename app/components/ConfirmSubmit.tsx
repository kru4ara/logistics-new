'use client';

import type { ReactNode } from 'react';
import { confirmDialog } from './Dialogs';

/** Кнопка отправки формы с подтверждением (удаление, отключение доступа). */
export default function ConfirmSubmit({ message, className, title, children }: { message: string; className?: string; title?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      title={title}
      onClick={async (e) => {
        // Сначала отменяем отправку, а после «Подтвердить» отправляем форму
        // этой же кнопкой — так в форму попадают её name/value и formAction.
        e.preventDefault();
        const btn = e.currentTarget;
        if (await confirmDialog(message, { danger: true })) btn.form?.requestSubmit(btn);
      }}
    >
      {children}
    </button>
  );
}
