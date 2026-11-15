import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Truck, MapPin, FileText, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { createClient } from '../../../lib/supabase/admin';
import { fetchAll, fetchAllByIds } from '../../../lib/fetch-all';
import { resolvePortal } from '../../../lib/portal';
import { portalLocale, publicStatus, mapLink, type PublicStatus } from '../../../lib/portal-rules';
import { LOCALES, LOCALE_LABELS, INTL_LOCALE, DEFAULT_LOCALE } from '../../../lib/i18n/config';
import { MESSAGES } from '../../../lib/i18n/messages';
import { createT, type MessageKey } from '../../../lib/i18n/translate';
import { buildRouteMap, type SegmentRouteRow } from '../../../lib/trip-route';
import { toReceivable, type ReceivableTrip } from '../../../lib/receivables';
import { getGpsProvider } from '../../../lib/gps';
import { getCompany } from '../../../lib/company';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };

const STATUS_UI: Record<PublicStatus, { key: MessageKey; cls: string }> = {
  planned: { key: 'portal.stPlanned', cls: 'bg-slate-100 text-slate-700' },
  inTransit: { key: 'portal.stInTransit', cls: 'bg-blue-50 text-blue-700' },
  delivered: { key: 'portal.stDelivered', cls: 'bg-emerald-50 text-emerald-700' },
  invoiced: { key: 'portal.stInvoiced', cls: 'bg-amber-50 text-amber-700' },
  paid: { key: 'portal.stPaid', cls: 'bg-emerald-50 text-emerald-700' },
};

const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

/** Последняя GPS-позиция своей машины за 3 часа (не дольше 6 с). */
async function lastPosition(deviceId: string): Promise<{ lat: number; lng: number; ts: number } | null> {
  const gps = getGpsProvider();
  if (!gps) return null;
  const now = Math.floor(Date.now() / 1000);
  const track = await Promise.race([
    gps.fetchTrack(deviceId, now - 3 * 3600, now).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 6000)),
  ]);
  const p = track?.points.filter((x) => x.lat != null && x.lng != null).at(-1);
  return p ? { lat: p.lat as number, lng: p.lng as number, ts: p.ts } : null;
}

export default async function PortalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { token } = await params;
  const locale = portalLocale((await searchParams).lang, (await headers()).get('accept-language'));
  const t = createT(MESSAGES[locale], MESSAGES[DEFAULT_LOCALE]);
  const fmtDate = (d: string | null | undefined) =>
    d ? new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(String(d).slice(0, 10) + 'T00:00:00Z')) : '—';
  const money = (n: number) => new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);

  const portal = await resolvePortal(token);
  if (!portal) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="card p-8 max-w-md text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">{t('portal.invalidTitle')}</h1>
          <p className="text-sm text-slate-500">{t('portal.invalidText')}</p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: client }, company] = await Promise.all([
    supabase.from('clients').select('id, name, payment_days').eq('id', portal.clientId).maybeSingle(),
    getCompany().catch(() => null),
  ]);
  const since = daysAgoIso(120);
  const { data: tripRows } = await fetchAll(
    supabase
      .from('trips')
      .select('id, trip_number, client_request_number, status, start_date, end_date, unload_date, truck_id, invoice_number, invoice_amount, invoice_currency, revenue_eur, invoiced_at, payment_due, invoice_external_id')
      .eq('client_id', portal.clientId)
      .or(`status.in.(planned,active,invoiced),start_date.gte.${since},end_date.gte.${since}`)
      .order('start_date', { ascending: false }),
  );
  const trips = ((tripRows ?? []) as any[]).filter((tr) => publicStatus(tr.status));
  const { data: segRows } = await fetchAllByIds(
    trips.map((tr) => tr.id),
    (chunk) => supabase.from('trip_segments').select('trip_id, position, from_city, from_country, to_city, to_country').in('trip_id', chunk),
  );
  const routes = buildRouteMap((segRows ?? []) as SegmentRouteRow[]);

  // Где машина: только рейсы в пути на своей машине с GPS.
  const active = trips.filter((tr) => tr.status === 'active' && tr.truck_id).slice(0, 5);
  const { data: trucks } = active.length
    ? await supabase.from('trucks').select('id, logisat_device_id, logisat_enabled').in('id', active.map((tr) => tr.truck_id))
    : { data: [] };
  const positions = new Map<string, { lat: number; lng: number; ts: number } | null>();
  await Promise.all(
    active.map(async (tr) => {
      const tk = ((trucks ?? []) as any[]).find((x) => x.id === tr.truck_id);
      if (tk?.logisat_enabled && tk.logisat_device_id) positions.set(tr.id, await lastPosition(String(tk.logisat_device_id)));
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  const unpaid = trips
    .filter((tr) => tr.status === 'invoiced')
    .map((tr) => toReceivable(tr as ReceivableTrip, client?.payment_days ?? null, today))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  const totalDue = unpaid.reduce((s, r) => s + r.amount, 0);
  const overdue = unpaid.filter((r) => (r.daysOverdue ?? 0) > 0).reduce((s, r) => s + r.amount, 0);
  const orders = trips;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[960px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{company?.name ?? ''}</div>
            <h1 className="text-2xl font-bold text-slate-900">{client?.name ?? ''}</h1>
            <p className="text-sm text-slate-500">{t('portal.subtitle')}</p>
          </div>
          <nav className="flex gap-1 text-xs">
            {LOCALES.map((l) => (
              <a key={l} href={`?lang=${l}`} className={`px-2 py-1 rounded ${l === locale ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>
                {LOCALE_LABELS[l]}
              </a>
            ))}
          </nav>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('portal.kpiInTransit')}</div>
            <div className="text-xl font-bold text-slate-900">{trips.filter((tr) => tr.status === 'active').length}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('portal.kpiDue')}</div>
            <div className="text-xl font-bold text-slate-900 tabular-nums">{money(totalDue)}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-slate-500">{t('portal.kpiOverdue')}</div>
            <div className={`text-xl font-bold tabular-nums ${overdue > 0 ? 'text-red-600' : 'text-slate-900'}`}>{money(overdue)}</div>
          </div>
        </section>

        <section className="card p-4 md:p-5 space-y-3">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><Truck className="w-5 h-5 text-brand-600" />{t('portal.orders')}</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-slate-400">{t('portal.noOrders')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((tr) => {
                const st = STATUS_UI[publicStatus(tr.status)!];
                const pos = positions.get(tr.id);
                return (
                  <li key={tr.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <div className="sm:w-40">
                      <div className="font-semibold text-slate-900">{tr.client_request_number ? t('portal.yourOrder', { n: tr.client_request_number }) : `№${tr.trip_number ?? '—'}`}</div>
                      <div className="text-xs text-slate-400">{fmtDate(tr.start_date)}{tr.unload_date || tr.end_date ? ` → ${fmtDate(tr.unload_date ?? tr.end_date)}` : ''}</div>
                    </div>
                    <div className="flex-1 text-sm text-slate-700">{routes.get(tr.id)?.route ?? '—'}</div>
                    <div className="flex flex-col items-start sm:items-end gap-1">
                      <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${st.cls}`}>{t(st.key)}</span>
                      {pos && (
                        <a href={mapLink(pos.lat, pos.lng)} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {t('portal.position', { time: new Intl.DateTimeFormat(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(pos.ts)) })}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-4 md:p-5 space-y-3">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-brand-600" />{t('portal.invoices')}</h2>
          {unpaid.length === 0 ? (
            <p className="text-sm text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{t('portal.allPaid')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="py-2 pr-3">{t('portal.colInvoice')}</th>
                  <th className="py-2 pr-3 text-right">{t('portal.colAmount')}</th>
                  <th className="py-2 pr-3">{t('portal.colDue')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unpaid.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-medium">{r.invoice_number ?? '—'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{money(r.amount)}</td>
                    <td className="py-2 pr-3">
                      <span className={(r.daysOverdue ?? 0) > 0 ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                        {r.due ? fmtDate(r.due) : '—'}
                      </span>
                      {(r.daysOverdue ?? 0) > 0 ? (
                        <span className="block text-xs text-red-600">{t('portal.overdueDays', { n: r.daysOverdue ?? 0 })}</span>
                      ) : r.due ? (
                        <span className="block text-xs text-slate-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{t('portal.daysLeft', { n: -(r.daysOverdue ?? 0) })}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right">
                      {(r as any).invoice_external_id && (
                        <a href={`/portal/${token}/invoice/${r.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">PDF</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center">{t('portal.footer')}</p>
      </div>
    </main>
  );
}
