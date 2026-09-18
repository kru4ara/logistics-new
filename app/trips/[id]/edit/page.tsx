import { createClient } from '../../../../lib/supabase-server';
import EditTripForm from './EditTripForm';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

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

  if (error) return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <a href={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к рейсу
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать рейс №{trip.trip_number || '—'}</h1>
        </div>

        <EditTripForm
          trip={trip}
          tripId={tripId}
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
