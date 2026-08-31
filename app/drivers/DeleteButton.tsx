'use client';

import { useTransition } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function DeleteButton({ driverId }: { driverId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const { error } = await supabase.from('drivers').delete().eq('id', driverId);
      if (error) {
        console.error('Ошибка удаления водителя:', error.message);
      }
      // Просто обновляем страницу после удаления
      window.location.reload();
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
