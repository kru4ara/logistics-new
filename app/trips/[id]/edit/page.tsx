import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase/admin';
import { scopedClient } from '../../../../lib/supabase/scoped';
import { can, deniedRedirect } from '../../../../lib/roles';
import { getSessionContext } from '../../../../lib/session';
import EditTripForm from './EditTripForm';
import { getScope, applyTripScope } from '../../../../lib/scope';
import { getT } from '../../../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const { id: tripId } = await params;

  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'trips.editAny');
  if (denied) redirect(denied);
  if (!can(role, 'trips.editAny')) redirect('/');

  const supabase = await createClient();
  const scoped = await scopedClient();

  // Скоуп (фаза 39): менеджер не должен открыть чужой заказ по прямой
  // ссылке — запрос ограничивается тем же фильтром, что и списки.
  const scope = await getScope();

  const { data: trip, error } = await applyTripScope(
      scoped
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

  if (error) return <div className="p-8 text-red-500">{t('trip.loadError', { msg: error.message })}</div>;

  // Цепочка машины (миграция 046): старт своего рейса ставит база — день после финиша
  // предыдущего рейса этой машины. Есть предыдущий завершённый рейс — поле только для чтения.
  let startLocked = false;
  if (trip.truck_id && trip.profit_mode !== 'forwarding') {
    // Через scopedClient, как и сам заказ: менеджеру база покажет только свои рейсы
    // (тогда поле просто не замкнётся — правило всё равно держит база).
    let q = scoped
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('truck_id', trip.truck_id)
      .neq('id', tripId)
      .neq('profit_mode', 'forwarding')
      .not('end_date', 'is', null);
    if (trip.end_date) q = q.lte('end_date', trip.end_date);
    const { count } = await q;
    startLocked = (count ?? 0) > 0;
  }

  // Переназначать заказ может только офис (фаза 39).
  const canChangeManager = can(role, 'managers.edit');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <Link href={`/trips/${tripId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          {t('tripForm.backToTrip')}
        </Link>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('tripForm.editTitle', { n: trip.trip_number || '—' })}</h1>
        </div>

        <EditTripForm
          trip={trip}
          tripId={tripId}
          clients={(clients || []).map((c) => ({ id: c.id, label: c.name }))}
          managers={(managers || []).map((m) => ({ id: m.id, label: m.full_name }))}
          canChangeManager={canChangeManager}
          startLocked={startLocked}
        />  
      </div>
    </main>
  );
}
