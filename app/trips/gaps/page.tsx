import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Truck } from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { fetchAll } from '../../../lib/fetch-all';
import { getSessionContext } from '../../../lib/session';
import { can, deniedRedirect } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { formatDate } from '../../../lib/i18n/format';
import { findChainIssues, type ChainTrip } from '../../../lib/truck-chain';
import { CloseGapButton, CloseAllGapsButton, KeepAsIsButton } from './GapButtons';

export const dynamic = 'force-dynamic';

/** Дыры и пересечения между рейсами одной нашей машины — закрыть кнопкой. */
export default async function TripGapsPage() {
  const { role } = await getSessionContext();
  // Без скоупа менеджера (цепочке нужны все рейсы машины) — только офис и бухгалтер.
  const denied = deniedRedirect(role, 'reports.viewAll');
  if (denied) redirect(denied);
  const canEdit = can(role, 'trips.editAny');
  const { t, locale } = await getT();
  const supabase = await createClient();

  const COLS = 'id, trip_number, client_request_number, truck_id, start_date, end_date, status, profit_mode, created_at, clients(name)';
  const full = await fetchAll(supabase.from('trips').select(`${COLS}, chain_exempt`).not('truck_id', 'is', null).order('id'));
  // До миграции 047 колонки нет — без исключений.
  const { data } = full.error ? await fetchAll(supabase.from('trips').select(COLS).not('truck_id', 'is', null).order('id')) : full;
  const trips = (data ?? []) as (ChainTrip & { trip_number: string | null; client_request_number: string | null; clients: any })[];
  const issues = findChainIssues(trips);
  const byId = new Map(trips.map((x) => [x.id, x]));
  const { data: trucks } = await supabase.from('trucks').select('id, registration_number');
  const truckName = new Map((trucks ?? []).map((x: any) => [x.id as string, x.registration_number as string]));

  const groups = new Map<string, typeof issues>();
  for (const i of issues) groups.set(i.truckId, [...(groups.get(i.truckId) ?? []), i]);
  const num = (id: string) => {
    const x = byId.get(id);
    return x?.trip_number || x?.client_request_number || '—';
  };
  const fmt = (d: string | null) => (d ? formatDate(d, locale) : '—');
  const badge: Record<string, string> = {
    gap: 'bg-amber-50 text-amber-800',
    overlap: 'bg-red-50 text-red-700',
    noStart: 'bg-slate-100 text-slate-700',
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <Link href="/trips" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> {t('chain.back')}
        </Link>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{t('chain.title')}</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base max-w-3xl">{t('chain.hint')}</p>
          </div>
          {canEdit && issues.length > 0 && <CloseAllGapsButton tripIds={issues.map((i) => i.nextId)} />}
        </div>

        {issues.length === 0 ? (
          <div className="card p-10 text-center text-slate-600 font-semibold">{t('chain.empty')}</div>
        ) : (
          [...groups.entries()].map(([truckId, list]) => (
            <section key={truckId} className="card p-4 md:p-5">
              <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-brand-600" aria-hidden="true" />
                {truckName.get(truckId) ?? '—'}
                <span className="text-xs font-semibold text-slate-500">{t('chain.issuesN', { n: list.length })}</span>
              </h2>
              <div className="divide-y divide-slate-100">
                {list.map((i) => (
                  <div key={i.nextId} className="py-2.5 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-sm">
                    <span className="md:w-52 text-slate-600">
                      <Link href={`/trips/${i.prevId}`} className="font-semibold text-brand-700 hover:underline">№{num(i.prevId)}</Link>
                      {' '}{t('chain.endedOn', { d: fmt(i.prevEnd) })}
                    </span>
                    <span className="flex-1 min-w-0">
                      <Link href={`/trips/${i.nextId}`} className="font-semibold text-brand-700 hover:underline">№{num(i.nextId)}</Link>
                      {' '}{i.actualStart ? t('chain.startedOn', { d: fmt(i.actualStart) }) : t('chain.noStartYet')}
                      {' → '}<span className="font-semibold">{fmt(i.expectedStart)}</span>
                    </span>
                    <span className={`text-xs font-semibold rounded px-2 py-0.5 w-max ${badge[i.kind]}`}>
                      {i.kind === 'gap' ? t('chain.gapDays', { n: i.days }) : i.kind === 'overlap' ? t('chain.overlapDays', { n: -i.days }) : t('chain.noStart')}
                    </span>
                    {canEdit && (
                      <span className="flex items-start gap-2">
                        <KeepAsIsButton tripId={i.nextId} />
                        <CloseGapButton tripId={i.nextId} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
