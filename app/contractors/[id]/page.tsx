import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';

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

function flagFor(country: string | null): string {
  if (!country) return '';
  const c = country.toLowerCase().trim();
  if (c.includes('pol')) return '🇵🇱';
  if (c === 'belarus' || c.includes('бел')) return '🇧🇾';
  if (c.includes('lit') || c.includes('lith')) return '🇱🇹';
  if (c.includes('latv')) return '🇱🇻';
  if (c.includes('est')) return '🇪🇪';
  if (c.includes('germ') || c.includes('deutsch') || c === 'de') return '🇩🇪';
  if (c.includes('neth') || c.includes('holland') || c === 'nl') return '🇳🇱';
  if (c.includes('belg') || c === 'be') return '🇧🇪';
  if (c.includes('fran') || c === 'fr') return '🇫🇷';
  if (c.includes('ital') || c === 'it') return '🇮🇹';
  if (c.includes('spain') || c.includes('espa') || c === 'es') return '🇪🇸';
  if (c.includes('bulg') || c === 'bg') return '🇧🇬';
  if (c.includes('czech') || c.includes('чех') || c === 'cz') return '🇨🇿';
  if (c.includes('slovak') || c === 'sk') return '🇸🇰';
  if (c.includes('ukrain') || c.includes('укр') || c === 'ua') return '🇺🇦';
  if (c.includes('russ') || c.includes('рос') || c === 'ru') return '🇷🇺';
  return '';
}

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

export default async function ContractorCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
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
          <a
            href="/contractors"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium mb-6"
          >
            ← Все подрядчики
          </a>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="text-5xl mb-4">🚫</div>
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

  // 2. Работы: комбинированные перевозки (trip_subcontractors)
  const { data: tripSubs } = await supabase
    .from('trip_subcontractors')
    .select(`
      id,
      trip_id,
      price_eur,
      original_price,
      currency,
      payment_days,
      load_date,
      unload_date,
      load_country,
      load_city,
      unload_country,
      unload_city,
      trips(trip_number, client_request_number, route)
    `)
    .eq('contractor_id', id);

  // 3. Работы: экспедирование (forwarding_contractors)
  const { data: fwdSubs } = await supabase
    .from('forwarding_contractors')
    .select(`
      id,
      forwarding_id,
      price_eur,
      original_price,
      currency,
      payment_days,
      forwarding_orders(order_number, client_request_number, route_from, route_to, load_date, unload_date)
    `)
    .eq('contractor_id', id);

  // 4. Объединяем в один список
  const works: WorkItem[] = [];

  for (const s of tripSubs || []) {
    const trip: any = Array.isArray(s.trips) ? s.trips[0] : s.trips;
    if (!trip) continue;

    const numberBase = trip.client_request_number || (trip.trip_number ? `№${trip.trip_number}` : '—');
    const routeFrom = [s.load_country, s.load_city].filter(Boolean).join(', ') || '—';
    const routeTo = [s.unload_country, s.unload_city].filter(Boolean).join(', ') || '—';
    const route = trip.route || `${routeFrom} → ${routeTo}`;
    const date = s.unload_date || s.load_date;

    works.push({
      kind: 'trip',
      id: s.trip_id,
      number: numberBase,
      date,
      route,
      price_eur: s.price_eur || 0,
      original_price: s.original_price || 0,
      currency: s.currency || 'EUR',
      payment_days: s.payment_days || null,
      href: `/trips/${s.trip_id}`,
    });
  }

  for (const s of fwdSubs || []) {
    const fwd: any = Array.isArray(s.forwarding_orders) ? s.forwarding_orders[0] : s.forwarding_orders;
    if (!fwd) continue;

    const numberBase = fwd.client_request_number || (fwd.order_number ? `№${fwd.order_number}` : '—');
    const route = [fwd.route_from, fwd.route_to].filter(Boolean).join(' → ') || '—';
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

        <a
          href="/contractors"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
        >
          ← Все подрядчики
        </a>

        {/* ЗАГОЛОВОК */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-medium">Подрядчик</div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1 break-words">
                {c.name || '—'}
              </h1>
              {c.full_name && c.full_name !== c.name && (
                <div className="text-sm text-slate-500 mt-1 break-words">
                  {c.full_name}
                </div>
              )}
              {c.country && (
                <div className="text-sm text-slate-500 mt-1">
                  {flagFor(c.country)} {c.country}
                </div>
              )}
            </div>
            <a
              href={`/contractors/${c.id}/edit`}
              className="self-start px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium
                         hover:bg-slate-100 transition-all text-sm whitespace-nowrap"
            >
              ✏️ Редактировать
            </a>
          </div>
        </div>

        {/* РЕКВИЗИТЫ */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Реквизиты</h2>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {c.tax_id && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">NIP / Tax ID</div>
                <div className="text-slate-800 font-medium text-sm break-words">{c.tax_id}</div>
              </div>
            )}
            {c.address && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Адрес</div>
                <div className="text-slate-800 font-medium text-sm break-words">{c.address}</div>
              </div>
            )}
            {c.contact_person && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Контактное лицо</div>
                <div className="text-slate-800 font-medium text-sm break-words">{c.contact_person}</div>
              </div>
            )}
            {c.phone && (
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Телефон</div>
                <div className="text-slate-800 font-medium text-sm">
                  <a href={`tel:${c.phone}`} className="hover:text-blue-600">{c.phone}</a>
                </div>
              </div>
            )}
            {c.email && (
              <div className="sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">Email</div>
                <div className="text-slate-800 font-medium text-sm break-words">
                  <a href={`mailto:${c.email}`} className="hover:text-blue-600">{c.email}</a>
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Всего работ
            </div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900">
              {totalCount}
            </div>
            {totalCount > 0 && (
              <div className="text-xs text-slate-400 mt-1">
                {tripCount > 0 && `рейсы: ${tripCount}`}
                {tripCount > 0 && fwdCount > 0 && ' · '}
                {fwdCount > 0 && `эксп.: ${fwdCount}`}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Общая сумма
            </div>
            <div className="text-2xl md:text-3xl font-bold text-red-500 break-words">
              {fmtEur(totalSum)}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Последняя работа
            </div>
            <div className="text-base md:text-lg font-bold text-slate-900">
              {lastWork?.date ? fmtDate(lastWork.date) : '—'}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
              Оплата
            </div>
            <div className="text-2xl md:text-3xl font-bold text-blue-600">
              {avgPaymentDays ? `${avgPaymentDays} дн` : '—'}
            </div>
            {avgPaymentDays && (
              <div className="text-xs text-slate-400 mt-1">средний срок</div>
            )}
          </div>
        </div>

        {/* РАБОТЫ */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-900">📋 Работы</h2>
            {works.length > 20 && (
              <span className="text-xs text-slate-400">
                показано 20 из {works.length}
              </span>
            )}
          </div>

          {works.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              С этим подрядчиком ещё не было работ.
            </div>
          ) : (
            <div className="space-y-2">
              {displayedWorks.map((w) => (
                <a
                  key={`${w.kind}-${w.id}`}
                  href={w.href}
                  className="block border border-slate-100 rounded-xl p-3 md:p-4 bg-slate-50/40
                             hover:bg-blue-50/40 hover:border-blue-200 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          w.kind === 'trip'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {w.kind === 'trip' ? '🚛 Рейс' : '📦 Эксп.'}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">
                          {w.number}
                        </span>
                        {w.date && (
                          <span className="text-xs text-slate-500">
                            · {fmtDate(w.date)}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 break-words">
                        {w.route}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold text-red-500 whitespace-nowrap">
                        {w.original_price} {w.currency}
                      </div>
                      <div className="text-xs text-slate-400">
                        ≈ {w.price_eur.toFixed(0)} €
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {works.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-baseline gap-2 flex-wrap">
              <span className="text-sm text-slate-500">
                Всего работ: <b className="text-slate-700">{totalCount}</b>
              </span>
              <span className="text-sm text-slate-500">
                Итого: <b className="text-red-500 text-base">{fmtEur(totalSum)}</b>
              </span>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
