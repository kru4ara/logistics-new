import { supabase } from '../lib/supabaseClient';
import { redirect } from 'next/navigation';

export default async function Home() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // ... остальной код (Фрахт, Расходы и т.д.)
}
