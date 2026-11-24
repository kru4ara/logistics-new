import Link from 'next/link';
import { Layers } from 'lucide-react';
import { getT } from '../../../lib/i18n/server';
import { AddToGroup, RemoveFromGroup } from './TripGroupControls';

export type GroupOrder = {
  id: string;
  trip_number: number | string | null;
  client: string | null;
  revenue: number;
  invoice_number: string | null;
  paid: boolean;
};

const eur = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} €`;

/** Сборный рейс: заказы в этой машине и экономика рейса целиком. */
export default async function TripGroup({
  tripId,
  role,
  leader,
  orders,
  economics,
  candidates,
  readOnly,
  canLead = true,
}: {
  tripId: string;
  role: 'leader' | 'member' | null;
  leader: { id: string; trip_number: number | string | null } | null;
  orders: GroupOrder[];
  economics: { revenue: number; expenses: number; profit: number; orders: number } | null;
  candidates: { id: string; label: string }[];
  readOnly: boolean;
  /** Рейс с исполнителем — может стать ведущим. */
  canLead?: boolean;
}) {
  const { t } = await getT();

  if (role === 'member' && leader) {
    return (
      <section className="card p-4 border-l-4 border-indigo-400">
        <div className="flex items-start gap-3">
          <Layers className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-slate-700 min-w-0">
            <div className="font-semibold text-slate-900">{t('group.memberTitle')}</div>
            <div>
              {t('group.memberText')}{' '}
              <Link href={`/trips/${leader.id}`} className="text-indigo-700 font-semibold hover:underline">
                {t('group.leaderLink', { n: String(leader.trip_number ?? '—') })}
              </Link>
            </div>
            {!readOnly && <div className="mt-2"><RemoveFromGroup memberId={tripId} /></div>}
          </div>
        </div>
      </section>
    );
  }

  // Обычный рейс: блок с подсказкой виден тому, кто может собрать группу
  // (страница передаёт его только рейсам с исполнителем).
  if (role !== 'leader' && (readOnly || !canLead)) return null;

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-indigo-500" aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-900">{t('group.title')}</h2>
        {role === 'leader' && (
          <span className="ml-auto text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">
            {t('group.ordersBadge', { n: orders.length })}
          </span>
        )}
      </div>

      {role === 'leader' ? (
        <>
          <ul className="divide-y divide-slate-100 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="py-2 flex items-center gap-2">
                <Link href={`/trips/${o.id}`} className="font-semibold text-slate-900 hover:underline shrink-0">
                  №{o.trip_number ?? '—'}
                </Link>
                <span className="truncate text-slate-600 min-w-0 flex-1">
                  {o.client || '—'}
                  {o.id === tripId && <span className="ml-1 text-xs text-slate-400">({t('group.thisOrder')})</span>}
                </span>
                <span className="tabular-nums text-slate-900 shrink-0">{eur(o.revenue)}</span>
                <span
                  className={`text-xs rounded px-1.5 py-0.5 shrink-0 ${o.paid ? 'bg-emerald-50 text-emerald-700' : o.invoice_number ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {o.paid ? t('group.paid') : o.invoice_number ? o.invoice_number : t('group.noInvoice')}
                </span>
                {!readOnly && o.id !== tripId && <RemoveFromGroup memberId={o.id} />}
              </li>
            ))}
          </ul>
          {economics && (
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">{t('group.revenue')}</div>
                <div className="font-semibold tabular-nums">{eur(economics.revenue)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t('group.expenses')}</div>
                <div className="font-semibold tabular-nums">{eur(economics.expenses)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{t('group.profit')}</div>
                <div className={`font-bold tabular-nums ${economics.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {eur(economics.profit)}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-600">{t('group.intro')}</p>
      )}

      {!readOnly && (
        <Link
          href={`/trips/new?group=${tripId}`}
          className="btn btn-primary w-full justify-center text-sm"
        >
          {t('group.newOrder')}
        </Link>
      )}
      {!readOnly && candidates.length > 0 && <AddToGroup leaderId={tripId} candidates={candidates} />}
    </section>
  );
}
