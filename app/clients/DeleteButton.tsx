'use client';

import { useTransition } from 'react';
import { deleteClient } from '../../delete-actions';

export default function DeleteButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteClient(clientId);
    });
  }

  return (
    <button
      onClick={handleDelete}
      style={{
        padding: '4px 10px',
        backgroundColor: '#ef4444',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        opacity: isPending ? 0.5 : 1
      }}
      disabled={isPending}
    >
      🗑️ Удалить
    </button>
  );
}
