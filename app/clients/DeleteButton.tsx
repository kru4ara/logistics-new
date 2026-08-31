'use client';

import { useTransition } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export default function DeleteButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) {
        console.error('Ошибка удаления клиента:', error.message);
      }
      revalidatePath('/clients');
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
