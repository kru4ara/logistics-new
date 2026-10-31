import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient as createServerClient } from '../../lib/supabase/server';
import { buildRouteMap, type SegmentRouteRow, type TripRouteInfo } from '../../lib/trip-route';
import TripsList from './TripsList';
import OnboardingCard from './OnboardingCard';
import {
  Rocket,
  Inbox,
  Search,
  X,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type ConsolidationPoint = {
  country: string | null;
  city: string | null;
  company: string | null;
  postal_code: string | null;
  address: string | null;
};

export default async function DriverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const cookieStore = await cookies();
  const userName = cookieStore.get('user_name')?.value
    ? decodeURIComponent(cookieStore.get('user_name')!.value)
    : 'Водитель';

  // 1. ПРОВЕРКА АВТОРИЗАЦИИ ЧЕРЕЗ СЕССИЮ (безопасно)
  const authClient = await createServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. БЕРЕМ РОЛЬ И DRIVER_ID ИЗ БАЗЫ (источник правды).
  //    Через RLS-клиент: политика profiles_select_own разрешает строку
  //    с id = auth.uid(). Никакого service_role.
  const { data: profile } = await authClient
    .from('profiles')
    .select('role, driver_id')
    .eq('id', user.id)
    .single();

  const role = profile?.role;
  const driverId = profile?.driver_id;

  if (role !== 'driver' || !driverId) {
    redirect('/login');
  }

  // Данные читаем через RLS-клиент (anon-ключ + сессия), а не через
  // admin-клиент: так политики RLS реально работают, и водитель видит
  // ровно свои рейсы — даже если проверку в коде удастся обойти.
  const supabase = authClient;

  const resolvedParams = await searchParams;

  // Профиль водителя — нужен для onboarded_at
  const { data: driver } = await supabase
    .from('drivers')
    .select('first_name, last_name, onboarded_at')
    .eq('id', driverId)
    .maybeSingle();

  const showOnboarding = !driver?.onboarded_at;

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, clients(name)')
    .eq('driver_id', driverId);

  if (error) {
    return <div className="p-6 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  const tripIds = trips?.map((t) => t.id) || [];

  const consolidationByTrip: Record<string, ConsolidationPoint> = {};
  const segmentsByTrip: Record<string, TripRouteInfo> = {};

  if (tripIds.length > 0) {
    const { data: segsAll } = await supabase
      .from('trip_segments')
      .select('trip_id, position, executor_type, from_city, from_country, to_city, to_country, to_company, to_postal_code, to_address, date_to')
      .in('trip_id', tripIds)
      .order('position', { ascending: true });

    // Консолидация: последний contractor-сегмент = точка C
    const best: Record<string, any> = {};
    (segsAll || []).forEach((s: any) => {
      if (s.executor_type !== 'contractor') return;
      const cur = best[s.trip_id];
      if (!cur) {
        best[s.trip_id] = s;
        return;
      }
      const posDiff = (s.position || 0) - (cur.position || 0);
      if (posDiff > 0) {
        best[s.trip_id] = s;
      } else if (posDiff === 0) {
        const sDate = s.date_to ? new Date(s.date_to).getTime() : 0;
        const cDate = cur.date_to ? new Date(cur.date_to).getTime() : 0;
        if (sDate > cDate) best[s.trip_id] = s;
      }
    });

    Object.entries(best).forEach(([tId, s]) => {
      consolidationByTrip[tId] = {
        country: s.to_country,
        city: s.to_city,
        company: s.to_company,
        postal_code: s.to_postal_code,
        address: s.to_address,
      };
    });

    const routeMap = buildRouteMap(
      (segsAll || []).map((s: any) => ({
        trip_id: s.trip_id,
        position: s.position,
        from_city: s.from_city,
        from_country: s.from_country,
        to_city: s.to_city,
        to_country: s.to_country,
      })) as SegmentRouteRow[]
    );
    routeMap.forEach((info, tripId) => {
      segmentsByTrip[tripId] = info;
    });
  }

  // ============================================================
  // ПОИСК + ФИЛЬТР ПО СТАТУСУ (водитель)
  // ============================================================
  const q = (resolvedParams?.q || '').trim();
  const qLower = q.toLowerCase();
  const statusFilter = resolvedParams?.status || null;

  function matchesSearch(t: any): boolean {
    if (!qLower) return true;
    const clientName = (t.clients as any)?.name || '';
    const routeInfo = segmentsByTrip[t.id];
    const route = routeInfo?.route || '';
    const haystack = [
      t.trip_number?.toString() || '',
      t.client_request_number || '',
      clientName,
      route,
      routeInfo?.from_city || '',
      routeInfo?.from_country || '',
      routeInfo?.to_city || '',
      routeInfo?.to_country || '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(qLower);
  }

  function matchesStatus(t: any): boolean {
    if (!statusFilter) return true;
    return t.status === statusFilter;
  }

  const filteredTrips = (trips || []).filter((t) => matchesSearch(t) && matchesStatus(t));

  const activeTrips = filteredTrips.filter((t) => t.status === 'active');
  const otherTrips = filteredTrips.filter((t) => t.status !== 'active');

  // ============================================================
  // Salary total
  // ============================================================
  let salaryTotal = 0;
  if (tripIds.length > 0) {
    const { data: salaryExpenses } = await supabase
      .from('trip_expenses')
      .select('amount_eur')
      .eq('category', 'salary')
      .in('trip_id', tripIds);
    salaryTotal = salaryExpenses?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTrips = trips?.filter((t) => {
    const dateStr = t.end_date || t.start_date;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }) || [];

  const monthKm = monthTrips.reduce((sum, t) => sum + (t.actual_km || 0), 0);
  const monthLiters = monthTrips.reduce((sum, t) => sum + (t.actual_liters || 0), 0);

  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
  const nextMonthStart = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  let monthSalary = 0;
  if (tripIds.length > 0) {
    const { data: monthSalaryExp } = await supabase
      .from('trip_expenses')
      .select('amount_eur')
      .eq('category', 'salary')
      .in('trip_id', tripIds)
      .gte('expense_date', monthStart)
      .lt('expense_date', nextMonthStart);
    monthSalary = monthSalaryExp?.reduce((sum, e) => sum + (e.amount_eur || 0), 0) || 0;
  }

  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const hasFilter = Boolean(q || statusFilter);
  const statusChips = [
    { value: null, label: 'Все' },
    { value: 'planned', label: 'Планируется' },
    { value: 'active', label: 'В пути' },
    { value: 'completed', label: 'Завершён' },
    { value: 'invoiced', label: 'Счёт' },
    { value: 'paid', label: 'Оплачен' },
  ];

  function buildUrl(overrides: { q?: string | null; status?: string | null }): string {
    const params = new URLSearchParams();
    const qq = overrides.q === undefined ? (q || null) : overrides.q;
    const st = overrides.status === undefined ? statusFilter : overrides.status;
    if (qq) params.set('q', qq);
    if (st) params.set('status', st);
    const s = params.toString();
    return s ? `/driver?${s}` : '/driver';
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-5">

        {/* Приветствие */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 shadow-brand-lg text-white">
          <div className="text-sm text-brand-100">Привет,</div>
          <div className="text-2xl font-bold mt-1 break-words">{userName}</div>
          <div className="text-sm text-brand-100 mt-3">
            Всего рейсов: <span className="font-bold text-white tabular-nums">{trips?.length || 0}</span>
          </div>
        </div>

        {/* Онбординг */}
        {showOnboarding && <OnboardingCard driverName={userName} />}

        {/* Поиск + фильтр */}
        <div className="card p-4 space-y-3">
          <form method="GET" action="/driver" className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2.2} />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Рейс, клиент, город, заявка..."
              className="input pl-10 pr-10"
            />
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            {q && (
              <a
                href={buildUrl({ q: null })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Очистить"
              >
                <X className="w-4 h-4" strokeWidth={2.2} />
              </a>
            )}
          </form>

          <div className="flex flex-wrap gap-1.5">
            {statusChips.map(({ value, label }) => {
              const active = statusFilter === value;
              return (
                <a
                  key={value || 'all'}
                  href={buildUrl({ status: value })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                    ${active
                      ? 'bg-brand-600 text-white shadow-brand'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  {label}
                </a>
              );
            })}
          </div>

          {hasFilter && (
            <div className="text-xs text-slate-500 pt-1 border-t border-slate-100">
              Найдено рейсов: <b className="text-slate-700 tabular-nums">{filteredTrips.length}</b>
              {q && <> · по запросу «{q}»</>}
              {' · '}
              <a href="/driver" className="text-brand-600 hover:underline">Сбросить</a>
            </div>
          )}
        </div>

        {/* Если ничего не найдено */}
        {hasFilter && filteredTrips.length === 0 && (
          <div className="card p-10 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-7 h-7 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="text-slate-500 text-sm">Ничего не найдено</div>
            <a href="/driver" className="text-xs text-brand-600 hover:underline mt-2 inline-block">
              Сбросить фильтры
            </a>
          </div>
        )}

        {/* АКТИВНЫЕ РЕЙСЫ */}
        {activeTrips.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                <Rocket className="w-5 h-5 text-brand-600" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">В пути</h2>
                <div className="text-xs text-slate-400 tabular-nums">
                  Активных рейсов: {activeTrips.length}
                </div>
              </div>
            </div>
            <TripsList
              trips={activeTrips}
              consolidationByTrip={consolidationByTrip}
              segmentsByTrip={segmentsByTrip}
              initialVisible={20}
            />
          </div>
        )}

        {/* Статистика за месяц */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            {monthName}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="card p-4 sm:p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Рейсов за месяц</div>
              <div className="text-2xl font-bold text-brand-600 tabular-nums">{monthTrips.length}</div>
            </div>
            <div className="card p-4 sm:p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Зарплата за месяц</div>
              <div className="text-2xl font-bold text-emerald-600 tabular-nums">{monthSalary.toFixed(0)} €</div>
            </div>
            <div className="card p-4 sm:p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Пройдено км</div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{monthKm.toFixed(0)}</div>
            </div>
            <div className="card p-4 sm:p-5">
              <div className="text-xs text-slate-400 font-medium mb-1">Израсходовано топлива</div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{monthLiters.toFixed(0)} л</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2 px-1">
            Зарплата за всё время: <b className="text-slate-600 tabular-nums">{salaryTotal.toFixed(0)} €</b>
          </div>
        </div>

        {/* История рейсов */}
        <div>
          <h2 className="text-xs md:text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
            История рейсов
          </h2>
          {otherTrips.length === 0 && !hasFilter ? (
            <div className="card p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-brand-500" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                {activeTrips.length > 0 ? 'Завершённых рейсов пока нет' : 'Рейсов пока нет'}
              </h2>
              <p className="text-slate-500 text-sm">Ожидайте заданий от офиса</p>
            </div>
          ) : otherTrips.length === 0 && hasFilter ? null : (
            <TripsList
              trips={otherTrips}
              consolidationByTrip={consolidationByTrip}
              segmentsByTrip={segmentsByTrip}
              initialVisible={5}
            />
          )}
        </div>

      </div>
    </main>
  );
}
