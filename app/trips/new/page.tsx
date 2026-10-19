import { createClient } from '../../../lib/supabase-server';
import NewTripForm from './NewTripForm';
import { ArrowLeft, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  const { data: loadingLocations } = await supabase
    .from('locations')
    .select('*')
    .in('type', ['loading', 'both'])
    .order('name');

  const { data: unloadingLocations } = await supabase
    .from('locations')
    .select('*')
    .in('type', ['unloading', 'both'])
    .order('name');

  const { data: customsLocations } = await supabase
    .from('locations')
    .select('*')
    .in('type', ['customs', 'both'])
    .order('name');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/trips"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все рейсы
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Package className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Новая заявка
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Внесите данные из заявки клиента. Транспорт добавите позже, когда найдёте машину.
          </p>
        </div>

        <NewTripForm
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          loadingLocations={(loadingLocations || []) as any}
          unloadingLocations={(unloadingLocations || []) as any}
          customsLocations={(customsLocations || []) as any}
        />

      </div>
    </main>
  );
}
