import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import TripsList from './TripsList';
import OnboardingCard from './OnboardingCard';
import {
  Rocket,
  RadioTower,
  BarChart3,
  Inbox,
  ArrowRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type ConsolidationPoint = {
  country: string | null;
  city: string | null;
  company: string | null;
  postal_code: string | null;
  address: string | null;
};

export default async function DriverPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  const driverId = cookieStore.get('driver_id')?.value;
  const userName = cookieStore.get('user_name')?.value
    ? decodeURIComponent(cookieStore.get('user_name')!.value)
    : 'Водитель';

  if (role !== 'driver' || !driverId) {
    redirect('/login');
  }

  const supabase = await createClient();

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
    .eq('driver_id', driverId)
    .order('trip_number', { ascending: false });

  if (error) {
    return <div className="p-6 text-red-500">Ошибка загрузки рейсов: {error.message}</div>;
  }

  const tripIds = trips?.map((t) => t.id) || [];

  const consolidationByTrip: Record<string, ConsolidationPoint> = {};

  if (tripIds.length > 0) {
    const { data: subs } = await supabase
      .from('trip_subcontractors')
      .select('trip_id, position, unload_country, unload_city, unload_company, unload_postal_code, unload_address, unload_date')
      .in('trip_id', tripIds)
      .order('position', { ascending: true });

    const best: Record<string, any> = {};
    (subs || []).forEach((s: any) => {
      const cur = best[s.trip_id];
      if (!cur) {
        best[s.trip_id] = s;
        return;
      }
      const posDiff = (s.position || 0) - (cur.position || 0);
      if (posDiff > 0) {
        best[s.trip_id] = s;
      } else if (posDiff === 0) {
        const sDate = s.unload_date ? new Date(s.unload_date).getTime() : 0;
        const cDate = cur.unload_date ? new Date(cur.unload_date).getTime() : 0;
        if (sDate > cDate) best[s.trip_id] = s;
      }
    });

    Object.entries(best).forEach(([tId, s]) => {
      consolidationByTrip[tId] = {
        country: s.unload_country,
        city: s.unload_city,
        company: s.unload_company,
        postal_code: s.unload_postal_code,
        address: s.unload_address,
      };
    });
  }

  // Зарплата за всё время
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

  const activeTrips = (trips || []).filter((t) => t.status === 'active');
  const otherTrips = (trips || []).filter((t) => t.status !== 'active');

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

        {/* Онбординг — только при первом входе */}
        {showOnboarding && <OnboardingCard driverName={userName} />}

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
              initialVisible={20}
            />
          </div>
        )}

        {/* Ссылка на Logisat */}
        <a
          href="/driver/logisat"
          className="block card card-hover p-5 active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
              <RadioTower className="w-6 h-6 text-brand-600" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900">Logisat — расход топлива</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Проверить пробег и расход по машине за период
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 shrink-0" strokeWidth={2.5} />
          </div>
        </a>

        {/* Ссылка на статистику */}
        <a
          href="/driver/stats"
          className="block card card-hover p-5 active:scale-[0.99]"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6 text-emerald-600" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900">Моя статистика</div>
              <div className="text-sm text-slate-500 mt-0.5">
                Рейсы, км, расход топлива и зарплата по месяцам
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-slate-300 shrink-0" strokeWidth={2.5} />
          </div>
        </a>

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
          {otherTrips.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-brand-500" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                {activeTrips.length > 0 ? 'Завершённых рейсов пока нет' : 'Рейсов пока нет'}
              </h2>
              <p className="text-slate-500 text-sm">Ожидайте заданий от офиса</p>
            </div>
          ) : (
            <TripsList
              trips={otherTrips}
              consolidationByTrip={consolidationByTrip}
              initialVisible={5}
            />
          )}
        </div>

      </div>
    </main>
  );
}
