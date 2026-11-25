import Link from 'next/link';
import { getSessionContext } from '../../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/admin';
import { scopedClient } from '../../../lib/supabase/scoped';
import { fetchAll, fetchAllByIds } from '../../../lib/fetch-all';
import type { RateRow } from '../../../lib/plan-fact';
import {
  factBySegmentOf,
  isCancelled,
  segmentKind,
  segmentPlanEur,
  type ContractorSegmentRow,
} from '../../../lib/contractor-stats';
import CountryFlag from '../../components/CountryFlag';
import {
  ArrowLeft,
  Pencil,
  Building2,
  FileText,
  MapPin,
  User as UserIcon,
  Phone,
  Mail,
  BarChart3,
  TrendingUp,
  CreditCard,
  Package,
  Truck,
  Route as RouteIcon,
  Calendar,
  Inbox,
} from 'lucide-react';
import { deniedRedirect } from '../../../lib/roles';
import { getT } from '../../../lib/i18n/server';
import { formatDate } from '../../../lib/i18n/format';
import { INTL_LOCALE, type Locale } from '../../../lib/i18n/config';

export const dynamic = 'force-dynamic';

type Contractor = {
  id: string;
  name: string;
  full_name: string | null;
  country: string | null;
  address: string | null;
  tax_id: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

type WorkItem = {
  kind: 'trip' | 'forwarding';
  segmentId: string;
  id: string;
  number: string;
  date: string | null;
  route: string;
  plan_eur: number;
  fact_eur: number | null;
  original_price: number;
  currency: string;
  payment_days: number | null;
  href: string;
};



function fmtEur(n: number, locale: Locale): string {
  return n.toLocaleString(INTL_LOCALE[locale], { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

// Маршрут экспедиции: точки лежат в trip_segments.stops (jsonb)
// в общем с рейсами формате {type:'load'|'reload'|'unload'|'customs', city, country}.
function stopStr(stop: any): string {
  if (!stop) return '';
  return [stop.city, stop.country].filter(Boolean).join(', ');
}

// Первая загрузка → последняя выгрузка.
function routeFromStops(stops: any): { from: string; to: string } {
  const list = Array.isArray(stops) ? stops : [];
  const firstLoad = list.find((s: any) => s.type === 'load');
  const lastUnload = [...list].reverse().find((s: any) => s.type === 'unload');
  return { from: stopStr(firstLoad), to: stopStr(lastUnload) };
}

export default async function ContractorCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { t, locale } = await getT();
  const { id } = await params;

  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'contractors.view');
  if (denied) redirect(denied);

  const supabase = await createClient();
  const scoped = await scopedClient();

  // 1. Сам подрядчик
  const { data: contractor, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contractor) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-[900px] mx-auto px-4 md:px-6 py-8">
          <Link
            href="/contractors"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium mb-6"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            {t('ctr.all')}
          </Link>
          <div className="card p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="text-lg font-bold text-slate-900 mb-1">{t('ctr.notFound')}</div>
            <div className="text-sm text-slate-500">
              {t('ctr.maybeDeleted')}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const c = contractor as Contractor;

  // 2. Работы — участки этого подрядчика. Каждый участок один раз: заказ в режиме
  //    экспедирования → «экспедирование», иначе → «рейс». Отменённые заказы не считаем.
  const SEG_COLS = `
      id, trip_id, contractor_id, price, currency, contractor_payment_days,
      date_from, date_to, from_country, from_city, to_country, to_city, stops,
      trips!inner(trip_number, client_request_number, status, profit_mode, start_date, end_date)`;
  const segRes = await fetchAll(
    scoped.from('trip_segments').select(SEG_COLS).eq('contractor_id', id).eq('executor_type', 'contractor').order('id'),
  );
  const segRows = ((segRes.data ?? []) as any[]).filter((s) => !isCancelled(s as ContractorSegmentRow));
  const segIds = segRows.map((s) => s.id as string);

  // 3. Факт — расходы рейса «Подрядчик» по участку (после счёта — сумма счёта), план — цена в EUR.
  const [expRes, rateRes] = await Promise.all([
    fetchAllByIds(segIds, (chunk) =>
      scoped.from('trip_expenses').select('segment_id, amount_eur').eq('category', 'contractor').in('segment_id', chunk),
    ),
    fetchAll(supabase.from('rates').select('rate_date, pln_to_eur, byn_to_eur').order('rate_date', { ascending: true })),
  ]);
  const loadError = segRes.error ?? expRes.error ?? rateRes.error;
  if (loadError) {
    return <div className="p-8 text-red-500">{t('dir.loadError')}{' '}{loadError.message}</div>;
  }
  const factBySeg = factBySegmentOf((expRes.data ?? []) as { segment_id: string | null; amount_eur: number | null }[]);
  const rates = (rateRes.data ?? []) as RateRow[];
  const today = new Date().toISOString().slice(0, 10);

  // 4. Список работ
  const works: WorkItem[] = segRows.map((s) => {
    const row = s as ContractorSegmentRow;
    const trip: any = Array.isArray(s.trips) ? s.trips[0] : s.trips;
    const kind = segmentKind(row);
    const number = trip?.client_request_number || (trip?.trip_number ? `№${trip.trip_number}` : '—');
    let route: string;
    let date: string | null;
    if (kind === 'trip') {
      const routeFrom = [s.from_country, s.from_city].filter(Boolean).join(', ') || '—';
      const routeTo = [s.to_country, s.to_city].filter(Boolean).join(', ') || '—';
      route = `${routeFrom} → ${routeTo}`;
      date = s.date_to || s.date_from || trip?.end_date || trip?.start_date || null;
    } else {
      // Маршрут экспедиции — из stops участка: первая загрузка → последняя выгрузка.
      const { from, to } = routeFromStops(s.stops);
      route = from || to ? `${from || '—'} → ${to || '—'}` : '—';
      date = trip?.end_date || trip?.start_date || null;
    }
    return {
      kind,
      segmentId: s.id,
      id: s.trip_id,
      number,
      date,
      route,
      plan_eur: segmentPlanEur(row, rates, today),
      fact_eur: factBySeg.has(s.id) ? Math.round((factBySeg.get(s.id) ?? 0) * 100) / 100 : null,
      original_price: Number(s.price) || 0,
      currency: (s.currency || 'EUR').toUpperCase(),
      payment_days: s.contractor_payment_days || null,
      href: `/trips/${s.trip_id}`,
    };
  });

  // 5. Сортируем по дате desc
  works.sort((a, b) => {
    const aT = a.date ? new Date(a.date).getTime() : 0;
    const bT = b.date ? new Date(b.date).getTime() : 0;
    return bT - aT;
  });

  // 6. Итоги
  // Сумма — факт (как в прибыли и в отчёте по подрядчикам).
  const totalSum = works.reduce((sum, w) => sum + (w.fact_eur ?? 0), 0);
  const totalCount = works.length;
  const lastWork = works[0] || null;
  const tripCount = works.filter((w) => w.kind === 'trip').length;
  const fwdCount = works.filter((w) => w.kind === 'forwarding').length;

  const paymentDaysList = works
    .map((w) => w.payment_days)
    .filter((p): p is number => p !== null && p > 0);
  const avgPaymentDays = paymentDaysList.length > 0
    ? Math.round(paymentDaysList.reduce((s, p) => s + p, 0) / paymentDaysList.length)
    : null;

  const displayedWorks = works.slice(0, 20);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link
          href="/contractors"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('ctr.all')}
        </Link>

        {/* ЗАГОЛОВОК */}
        <div className="card p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500
                              flex items-center justify-center shrink-0 shadow-brand">
                <Building2 className="w-7 h-7 md:w-8 md:h-8 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-400 font-medium">{t('expenseCat.contractor')}</div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 break-words tracking-tight">
                  {c.name || '—'}
                </h1>
                {c.full_name && c.full_name !== c.name && (
                  <div className="text-sm text-slate-500 mt-1 break-words">
                    {c.full_name}
                  </div>
                )}
                {c.country && (
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                    <CountryFlag country={c.country} />
                    <span>{c.country}</span>
                  </div>
                )}
              </div>
            </div>
            <Link
              href={`/contractors/${c.id}/edit`}
              className="btn btn-primary self-start text-sm whitespace-nowrap"
            >
              <Pencil className="w-4 h-4" strokeWidth={2} />
              {t('trip.edit')}
            </Link>
          </div>
        </div>

        {/* РЕКВИЗИТЫ */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" strokeWidth={2} />
            {t('ctr.details')}
          </h2>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {c.tax_id && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">NIP / Tax ID</div>
                <div className="text-slate-800 font-medium text-sm break-words tabular-nums">{c.tax_id}</div>
              </div>
            )}
            {c.address && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('settings.address')}</div>
                <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="break-words">{c.address}</span>
                </div>
              </div>
            )}
            {c.contact_person && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('dir.contact')}</div>
                <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                  <span className="break-words">{c.contact_person}</span>
                </div>
              </div>
            )}
            {c.phone && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('drv.phone')}</div>
                <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                  <a href={`tel:${c.phone}`} className="hover:text-brand-600 tabular-nums">{c.phone}</a>
                </div>
              </div>
            )}
            {c.email && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Email</div>
                <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                  <a href={`mailto:${c.email}`} className="hover:text-brand-600 break-all">{c.email}</a>
                </div>
              </div>
            )}
          </div>

          {!c.tax_id && !c.address && !c.contact_person && !c.phone && !c.email && (
            <div className="text-slate-400 text-sm py-4 text-center">
              {t('ctr.noDetails')}
            </div>
          )}

          {c.notes && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">{t('seg.notes')}</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{c.notes}</div>
            </div>
          )}
        </div>

        {/* СВОДКА */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">{t('ctr.totalWorks')}</span>
              <BarChart3 className="w-4 h-4 text-brand-600" strokeWidth={2} />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
              {totalCount}
            </div>
            {totalCount > 0 && (
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                {tripCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Truck className="w-3 h-3" strokeWidth={2} />
                    {tripCount}
                  </span>
                )}
                {tripCount > 0 && fwdCount > 0 && <span>·</span>}
                {fwdCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Package className="w-3 h-3" strokeWidth={2} />
                    {fwdCount}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">{t('ctr.totalSum')}</span>
              <TrendingUp className="w-4 h-4 text-red-500" strokeWidth={2} />
            </div>
            <div className="text-xl md:text-2xl font-bold text-red-500 break-words tabular-nums">
              {fmtEur(totalSum, locale)}
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">{t('ctr.lastWork')}</span>
              <Calendar className="w-4 h-4 text-slate-600" strokeWidth={2} />
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
              {lastWork?.date ? formatDate(lastWork.date, locale) : '—'}
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">{t('ctr.payment')}</span>
              <CreditCard className="w-4 h-4 text-brand-600" strokeWidth={2} />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
              {avgPaymentDays ? t('ctr.days', { n: avgPaymentDays }) : '—'}
            </div>
            {avgPaymentDays && (
              <div className="text-xs text-slate-400 mt-1">{t('ctr.avgTerm')}</div>
            )}
          </div>
        </div>

        {/* РАБОТЫ */}
        <div className="card p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RouteIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('ctr.works')}
            </h2>
            {works.length > 20 && (
              <span className="text-xs text-slate-400 tabular-nums">
                {t('ctr.shown20')}{' '} {works.length}
              </span>
            )}
          </div>

          {works.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Inbox className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
              </div>
              <div className="text-slate-400 text-sm">{t('ctr.noWorks')}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedWorks.map((w) => {
                const KindIcon = w.kind === 'trip' ? Truck : Package;
                return (
                  <Link
                    key={w.segmentId}
                    href={w.href}
                    className="block border border-slate-100 rounded-xl p-3 md:p-4 bg-slate-50/40
                               hover:bg-brand-50/40 hover:border-brand-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                            w.kind === 'trip'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-violet-100 text-violet-700'
                          }`}>
                            <KindIcon className="w-3 h-3" strokeWidth={2.2} />
                            {w.kind === 'trip' ? t('trips.kindTrip') : t('trips.kindForwardingShort')}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 tabular-nums">
                            {w.number}
                          </span>
                          {w.date && (
                            <span className="text-xs text-slate-500 tabular-nums">
                              · {formatDate(w.date, locale)}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-600 break-words">
                          {w.route}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-base font-bold text-red-500 whitespace-nowrap tabular-nums">
                          {w.original_price} {w.currency}
                        </div>
                        {w.currency !== 'EUR' && (
                          <div className="text-xs text-slate-400 tabular-nums">≈ {fmtEur(w.plan_eur, locale)}</div>
                        )}
                        {w.fact_eur != null && Math.abs(w.fact_eur - w.plan_eur) >= 1 && (
                          <div className="text-xs text-slate-600 tabular-nums">
                            {t('rep.ctrFact')}: {fmtEur(w.fact_eur, locale)}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {works.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-baseline gap-2 flex-wrap">
              <span className="text-sm text-slate-500">
                {t('ctr.totalWorksC')}{' '}<b className="text-slate-700 tabular-nums">{totalCount}</b>
              </span>
              <span className="text-sm text-slate-500">
                {t('expense.total')}{' '}<b className="text-red-500 text-base tabular-nums">{fmtEur(totalSum, locale)}</b>
              </span>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
