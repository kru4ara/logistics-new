import { supabase } from '../../../lib/supabaseClient';
import NewTripForm from './NewTripForm';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const { data: clients } = await supabase.from('clients').select('id, name').order('name');
  const { data: tractors } = await supabase.from('trucks').select('id, registration_number').eq('type', 'tractor');
  const { data: trailers } = await supabase.from('trucks').select('id, registration_number').eq('type', 'trailer');
  const { data: drivers } = await supabase.from('drivers').select('id, first_name, last_name');

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        <a href="/trips" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все рейсы
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Создать новый рейс</h1>
          <p className="text-slate-500 mt-1">Заполните данные для создания рейса</p>
        </div>

        <NewTripForm
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          tractors={(tractors || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          trailers={(trailers || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          drivers={(drivers || []).map((d) => ({ id: d.id, label: `${d.first_name} ${d.last_name}` }))}
          loadingLocations={loadingLocations || []}
          unloadingLocations={unloadingLocations || []}
        />

      </div>
    </main>
  );
}

// cache buster 2026-09-18
