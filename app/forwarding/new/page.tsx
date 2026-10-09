import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
import NewForwardingForm from './NewForwardingForm';
import { ArrowLeft, Boxes } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewForwardingPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: clients } = await supabase.from('clients').select('id, name').order('name');
  const { data: contractors } = await supabase.from('contractors').select('id, name').order('name');

  const { data: loadingLocations } = await supabase
    .from('locations')
    .select('id, name, city, country')
    .in('type', ['loading', 'both'])
    .order('name');

  const { data: unloadingLocations } = await supabase
    .from('locations')
    .select('id, name, city, country')
    .in('type', ['unloading', 'both'])
    .order('name');

  const formatLocLabel = (l: any) => {
    const parts = [l.name];
    if (l.city) parts.push(l.city);
    if (l.country) parts.push(l.country);
    return parts.join(' · ');
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/forwarding"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все заявки
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Boxes className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Новая заявка экспедирования
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Клиент → Мы → Подрядчики
          </p>
        </div>

        <NewForwardingForm
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          contractors={(contractors || []).map((c) => ({ id: c.id, label: c.name }))}
          loadingLocations={(loadingLocations || []).map((l) => ({ id: l.id, label: formatLocLabel(l) }))}
          unloadingLocations={(unloadingLocations || []).map((l) => ({ id: l.id, label: formatLocLabel(l) }))}
        />

      </div>
    </main>
  );
}
