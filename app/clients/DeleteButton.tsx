'use client';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export default function DeleteButton({ clientId }: { clientId: string }) {
  return (
    <form action={async () => {
      'use server';
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) {
        console.error('Ошибка удаления клиента:', error.message);
      }
      revalidatePath('/clients');
    }}>
      <button type="submit" style={{ padding: '4px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        🗑️ Удалить
      </button>
    </form>
  );
}
