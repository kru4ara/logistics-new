'use client';

import { supabase } from '../../lib/supabaseClient';
import { revalidatePath } from 'next/cache';

export default function DeleteButton({ driverId }: { driverId: string }) {
  return (
    <form action={async () => {
      'use server';
      const { error } = await supabase.from('drivers').delete().eq('id', driverId);
      if (error) {
        console.error('Ошибка удаления водителя:', error.message);
      }
      revalidatePath('/drivers');
    }}>
      <button type="submit" style={{ padding: '4px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        🗑️ Удалить
      </button>
    </form>
  );
}
