import Link from 'next/link';
import { getSessionContext } from '../../lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase-server';
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
  id: string;
  number: string;
  date: string | null;
  route: string;
  price_eur: number;
  original_price: number;
  currency: string;
  payment_days: number | null;
  href: string;
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

function fmtEur(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function pickLoc(rel: unknown): { city?: string; country?: string } {
  if (!rel) return {};
  if (Array.isArray(rel)) return (rel[0] || {}) as { city?: string; country?: string };
  return rel as { city?: string; country?: string };
}

function locStr(p: any): string {
  if (!p) return '';
  const loc = pickLoc(p.locations);
  return [loc.city, loc.country].filter(Boolean).join(', ');
}

export default async function ContractorCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { role } = await getSessionContext();
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

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
            Все подрядчики
          </Link>
          <div className="card p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="text-lg font-bold text-slate-900 mb-1">Подрядчик не найден</div>
            <div className="text-sm text-slate-500">
              Возможно, он был удалён или ссылка устарела.
            </div>
          </div>
        </div>
      </main>
    );
  }

  const c = contractor as Contractor;

  // 2. Работы: комбинированные перевозки (trip_segments, executor_type='contractor')
  //    Здесь route НЕ тянем из trips — маршрут участка берём из самого сегмента (from_*/to_*).
  const { data: tripSubs } = await supabase
    .from('trip_segments')
    .select(`
      id,
      trip_id,
      price,
      currency,
      date_from,
      date_to,
      from_country,
      from_city,
      to_country,
      to_city,
      trips(trip_number, client_request_number)
    `)
    .eq('contractor_id', id)
    .eq('executor_type', 'contractor');

  // 3. Работы: экспедирование (forwarding_contractors)
  //    Маршрут берём из forwarding_points (loading → unloading), НЕ из route_from/route_to.
  const { data: fwdSubs } = await supabase
    .from('forwarding_contractors')
    .select(`
      id,
      forwarding_id,
      price_eur,
      original_price,
      currency,
      payment_days,
      forwarding_orders(
        order_number,
        client_request_number,
        load_date,
        unload_date,
        forwarding_points(
          type,
          sequence,
          locations(country, city)
        )
      )
    `)
    .eq('contractor_id', id);

  // 4. Объединяем в один список
  const works: WorkItem[] = [];

  for (const s of tripSubs || []) {
    const trip: any = Array.isArray(s.trips) ? s.trips[0] : s.trips;
    if (!trip) continue;

    const numberBase = trip.client_request_number || (trip.trip_number ? `№${trip.trip_number}` : '—');
    const routeFrom = [s.from_country, s.from_city].filter(Boolean).join(', ') || '—';
    const routeTo = [s.to_country, s.to_city].filter(Boolean).join(', ') || '—';
    const route = `${routeFrom} → ${routeTo}`;
    const date = s.date_to || s.date_from;
    const price = Number(s.price) || 0;

    works.push({
      kind: 'trip',
      id: s.trip_id,
      number: numberBase,
      date,
      route,
      price_eur: price,
      original_price: price,
      currency: s.currency || 'EUR',
      payment_days: null,
      href: `/trips/${s.trip_id}`,
    });
  }

  for (const s of fwdSubs || []) {
    const fwd: any = Array.isArray(s.forwarding_orders) ? s.forwarding_orders[0] : s.forwarding_orders;
    if (!fwd) continue;

    const numberBase = fwd.client_request_number || (fwd.order_number ? `№${fwd.order_number}` : '—');

    // Маршрут из forwarding_points: первая загрузка → последняя выгрузка
    const points = Array.isArray(fwd.forwarding_points) ? fwd.forwarding_points : [];
    const sortedPoints = [...points].sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));
    const firstLoad = sortedPoints.find((p: any) => p.type === 'loading');
    const lastUnload = [...sortedPoints].reverse().find((p: any) => p.type === 'unloading');
    const routeFrom = locStr(firstLoad);
    const routeTo = locStr(lastUnload);
    const route = (routeFrom || routeTo) ? `${routeFrom || '—'} → ${routeTo || '—'}` : '—';

    const date = fwd.unload_date || fwd.load_date;

    works.push({
      kind: 'forwarding',
      id: s.forwarding_id,
      number: numberBase,
      date,
      route,
      price_eur: s.price_eur || 0,
      original_price: s.original_price || 0,
      currency: s.currency || 'EUR',
      payment_days: s.payment_days || null,
      href: `/forwarding/${s.forwarding_id}`,
    });
  }

  // 5. Сортируем по дате desc
  works.sort((a, b) => {
    const aT = a.date ? new Date(a.date).getTime() : 0;
    const bT = b.date ? new Date(b.date).getTime() : 0;
    return bT - aT;
  });

  // 6. Итоги
  const totalSum = works.reduce((sum, w) => sum + w.price_eur, 0);
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
          Все подрядчики
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
                <div className="text-xs text-slate-400 font-medium">Подрядчик</div>
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
              Редактировать
            </Link>
          </div>
        </div>

        {/* РЕКВИЗИТЫ */}
        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" strokeWidth={2} />
            Реквизиты
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
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Адрес</div>
                <div className="flex items-start gap-1.5 text-slate-800 font-medium text-sm">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                  <span className="break-words">{c.address}</span>
                </div>
              </div>
            )}
            {c.contact_person && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Контактное лицо</div>
                <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
                  <UserIcon className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={2} />
                  <span className="break-words">{c.contact_person}</span>
                </div>
              </div>
            )}
            {c.phone && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Телефон</div>
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
              Реквизиты не заполнены. Нажмите «Редактировать», чтобы добавить.
            </div>
          )}

          {c.notes && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Заметки</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{c.notes}</div>
            </div>
          )}
        </div>

        {/* СВОДКА */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">Всего работ</span>
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
              <span className="text-xs text-slate-400 font-medium">Общая сумма</span>
              <TrendingUp className="w-4 h-4 text-red-500" strokeWidth={2} />
            </div>
            <div className="text-xl md:text-2xl font-bold text-red-500 break-words tabular-nums">
              {fmtEur(totalSum)}
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">Последняя работа</span>
              <Calendar className="w-4 h-4 text-slate-600" strokeWidth={2} />
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900 tabular-nums">
              {lastWork?.date ? fmtDate(lastWork.date) : '—'}
            </div>
          </div>

          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">Оплата</span>
              <CreditCard className="w-4 h-4 text-brand-600" strokeWidth={2} />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-brand-600 tabular-nums">
              {avgPaymentDays ? `${avgPaymentDays} дн` : '—'}
            </div>
            {avgPaymentDays && (
              <div className="text-xs text-slate-400 mt-1">средний срок</div>
            )}
          </div>
        </div>

        {/* РАБОТЫ */}
        <div className="card p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RouteIcon className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Работы
            </h2>
            {works.length > 20 && (
              <span className="text-xs text-slate-400 tabular-nums">
                показано 20 из {works.length}
              </span>
            )}
          </div>

          {works.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center">
                <Inbox className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
              </div>
              <div className="text-slate-400 text-sm">С этим подрядчиком ещё не было работ.</div>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedWorks.map((w) => {
                const KindIcon = w.kind === 'trip' ? Truck : Package;
                return (
                  <Link
                    key={`${w.kind}-${w.id}`}
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
                            {w.kind === 'trip' ? 'Рейс' : 'Эксп.'}
                          </span>
                          <span className="text-sm font-semibold text-slate-800 tabular-nums">
                            {w.number}
                          </span>
                          {w.date && (
                            <span className="text-xs text-slate-500 tabular-nums">
                              · {fmtDate(w.date)}
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
                        <div className="text-xs text-slate-400 tabular-nums">
                          ≈ {w.price_eur.toFixed(0)} €
                        </div>
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
                Всего работ: <b className="text-slate-700 tabular-nums">{totalCount}</b>
              </span>
              <span className="text-sm text-slate-500">
                Итого: <b className="text-red-500 text-base tabular-nums">{fmtEur(totalSum)}</b>
              </span>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
