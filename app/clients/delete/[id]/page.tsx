import { createClient } from '../../../../lib/supabase/admin';
import { redirect } from 'next/navigation';
import { getT } from '../../../../lib/i18n/server';

export default async function DeleteClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const { id: clientId } = await params;

  if (!clientId) {
    return <div>{t('cli.noId')}</div>;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId);

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>{t('cli.deleteErr')}{' '} {error.message}</div>;
  }

  redirect('/clients');
}
