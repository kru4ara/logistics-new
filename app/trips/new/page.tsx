import { createClient } from '../../../lib/supabase-server';
import NewTripForm from './NewTripForm';
import { ArrowLeft, Package, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewTripPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  const { data: tractors } = await supabase
    .from('trucks')
    .select('id, registration_number')
    .eq('type', 'tractor');

  const { data: trailers } = await supabase
    .from('trucks')
    .select('id, registration_number')
    .eq('type', 'trailer');

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, first_name, last_name');

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

  // Последний рейс каждой машины → для авто-подстановки даты старта.
  const tractorIds = (tractors || []).map((t) => t.id);
  const lastEndDates: Record<string, { end_date: string; trip_number: number | null }> = {};

  if (tractorIds.length > 0) {
    const { data: trips } = await supabase
      .from('trips')
      .select('truck_id, start_date, end_date, trip_number')
      .in('truck_id', tractorIds)
      .order('start_date', { ascending: false });

    const seen = new Set<string>();
    for (const t of trips || []) {
      if (!t.truck_id || seen.has(t.truck_id)) continue;
      seen.add(t.truck_id);
      if (t.end_date) {
        lastEndDates[t.truck_id] = {
          end_date: t.end_date,
          trip_number: t.trip_number ?? null,
        };
      }
    }
  }

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
            Создать новый рейс
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Заполните данные для создания рейса
          </p>
        </div>

        <NewTripForm
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          tractors={(tractors || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          trailers={(trailers || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          drivers={(drivers || []).map((d) => ({ id: d.id, label: `${d.first_name} ${d.last_name}` }))}
          loadingLocations={loadingLocations || []}
          unloadingLocations={unloadingLocations || []}
          lastEndDates={lastEndDates}
        />

      </div>
    </main>
  );
}
