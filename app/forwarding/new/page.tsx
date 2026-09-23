import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import NewForwardingForm from './NewForwardingForm';

export const dynamic = 'force-dynamic';

export default async function NewForwardingPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: clients } = await supabase.from('clients').select('id, name').order('name');
  const { data: contractors } = await supabase.from('contractors').select('id, name').order('name');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/forwarding" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все заявки
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">➕ Новая заявка экспедирования</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Клиент → Мы → Подрядчики</p>
        </div>

        <NewForwardingForm
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          contractors={(contractors || []).map((c) => ({ id: c.id, label: c.name }))}
        />

      </div>
    </main>
  );
}
