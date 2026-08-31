import { supabase } from '../../../../lib/supabaseClient';
import { redirect } from 'next/navigation';

export default async function DeleteClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  if (!clientId) {
    return <div>Ошибка: ID клиента не передан</div>;
  }

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Ошибка удаления: {error.message}</div>;
  }

  redirect('/clients');
}
