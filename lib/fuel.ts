/**
 * Остаток топлива в баке тягача.
 *
 * Прямых замеров остатка в системе нет: колонка trips.end_fuel_level
 * пустая у всех рейсов. Поэтому остаток считается из рейса:
 *
 *   остаток = start_fuel_level + заправки по рейсу - actual_liters
 *
 * Формула ровно та же, что уже применяется в карточке рейса
 * (app/trips/[id]/page.tsx) и при автозаполнении стартового уровня
 * (app/trips/[id]/segment-actions.ts) - здесь она живёт в одном месте,
 * чтобы не разъезжалась.
 *
 * Если рейс ещё идёт (actual_liters неизвестен), расход ещё не учтён:
 * остаток известен лишь приблизительно - start_fuel_level + заправки.
 * Такие значения помечаются isEstimate.
 */

export type FuelTripRow = {
  id: string;
  truck_id: string | null;
  trip_number: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  start_fuel_level: number | null;
  actual_liters: number | null;
};

export type FuelExpenseRow = {
  trip_id: string | null;
  liters: number | null;
};

export type FuelLevel = {
  /** Остаток в баке, литры. null - замеров нет. */
  liters: number | null;
  /** true - рейс ещё идёт, расход не учтён (значение приблизительное). */
  isEstimate: boolean;
  /** Номер рейса, по которому взят показатель. */
  tripNumber: string | null;
  /** Дата замера (конец рейса, иначе его начало). */
  date: string | null;
};

const EMPTY: FuelLevel = {
  liters: null,
  isEstimate: false,
  tripNumber: null,
  date: null,
};

function tripNumberValue(tripNumber: string | null): number {
  const n = Number(tripNumber);
  return Number.isFinite(n) ? n : -1;
}

/** Округление до десятых - как в карточке рейса. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Последний показатель остатка топлива по одному тягачу.
 * Берётся рейс с наибольшим номером - нумерация сквозная по базе.
 */
export function latestFuelForTruck(
  trips: FuelTripRow[],
  fuelExpenses: FuelExpenseRow[]
): FuelLevel {
  const numbered = trips.filter((t) => t.truck_id && t.trip_number != null);
  if (numbered.length === 0) return { ...EMPTY };

  const latest = [...numbered].sort(
    (a, b) => tripNumberValue(b.trip_number) - tripNumberValue(a.trip_number)
  )[0];

  const start = latest.start_fuel_level ?? 0;
  const refuel = fuelExpenses
    .filter((e) => e.trip_id === latest.id)
    .reduce((sum, e) => sum + (e.liters ?? 0), 0);
  const consumed = latest.actual_liters ?? 0;

  const isEstimate = !(consumed > 0);
  const liters = isEstimate ? start + refuel : start + refuel - consumed;

  return {
    liters: Math.max(0, round1(liters)),
    isEstimate,
    tripNumber: latest.trip_number,
    date: latest.end_date || latest.start_date,
  };
}

/**
 * Последний показатель остатка по всем тягачам сразу.
 * Возвращает карту: id тягача -> показатель.
 */
export function calculateFuelLevels(
  trips: FuelTripRow[],
  fuelExpenses: FuelExpenseRow[]
): Map<string, FuelLevel> {
  const byTruck = new Map<string, FuelTripRow[]>();
  trips.forEach((t) => {
    if (!t.truck_id) return;
    if (!byTruck.has(t.truck_id)) byTruck.set(t.truck_id, []);
    byTruck.get(t.truck_id)!.push(t);
  });

  const result = new Map<string, FuelLevel>();
  byTruck.forEach((rows, truckId) => {
    result.set(truckId, latestFuelForTruck(rows, fuelExpenses));
  });
  return result;
}

/** Литры для показа: "233,5" / "180" / "—" */
export function formatLiters(liters: number | null): string {
  if (liters == null) return '—';
  return liters.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}
