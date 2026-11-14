import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/admin';
import { can, deniedRedirect } from '../../../../lib/roles';
import { getSessionContext } from '../../../../lib/session';
import EditTripForm from './EditTripForm';
import { getScope, applyTripScope } from '../../../../lib/scope';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tripId } = await params;

  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'trips.editAny');
  if (denied) redirect(denied);
  if (!can(role, 'trips.editAny')) redirect('/');

  const supabase = await createClient();

  // Скоуп (фаза 39): менеджер не должен открыть чужой заказ по прямой
  // ссылке — запрос ограничивается тем же фильтром, что и списки.
  const scope = await getScope();

  const { data: trip, error } = await applyTripScope(
      supabase
        .from('trips')
        .select('*'),
      scope
    )
    .eq('id', tripId)
    .single();

  const { data: clients } = await supabase.from('clients').select('id, name').order('name');

  const { data: managers } = await supabase
    .from('managers')
    .select('id, full_name')
    .eq('active', true)
    .order('full_name');

  if (error) return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;

  // Переназначать заказ может только офис (фаза 39).
  const canChangeManager = can(role, 'managers.edit');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <Link href={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к рейсу
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать заявку №{trip.trip_number || '—'}</h1>
        </div>

        <EditTripForm
          trip={trip}
          tripId={tripId}
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          managers={(managers || []).map((m) => ({ id: m.id, label: m.full_name }))}
          canChangeManager={canChangeManager}
        />  
      </div>
    </main>
  );
}
