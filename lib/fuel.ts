/**
 * Остаток топлива в баке тягача.
 *
 * Прямых замеров остатка в системе нет: колонка trips.end_fuel_level
 * пустая у всех рейсов. Поэтому остаток считается из рейса:
 *
 *   остаток = start_fuel_level + заправки по рейсу - actual_liters
 *
 * Это ЕДИНСТВЕННОЕ место в проекте, где живёт формула остатка.
 * И отображение (lib/fuel-server.ts -> карточка рейса, список тягачей,
 * вкладка «Сегодня»), и автозаполнение start_fuel_level при добавлении
 * нашей машины в сегмент (app/trips/[id]/segment-actions.ts) считают
 * через эти функции - чтобы значения не разъезжались.
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

/**
 * Числовое значение номера рейса.
 * Номера сквозные по базе, но встречаются и нечисловые («31Е»).
 * Для таких номеров число не разобрать - возвращаем -1,
 * а при сортировке такие рейсы встают в конец.
 */
export function tripNumberValue(tripNumber: string | null): number {
  const n = Number(tripNumber);
  return Number.isFinite(n) ? n : -1;
}

/** Округление до десятых - как в карточке рейса. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Сумма заправок по рейсу (расходы категории 'fuel').
 */
export function totalRefuelLiters(
  tripId: string,
  fuelExpenses: FuelExpenseRow[]
): number {
  return fuelExpenses
    .filter((e) => e.trip_id === tripId)
    .reduce((sum, e) => sum + (e.liters ?? 0), 0);
}

/**
 * Остаток топлива по одному рейсу - единая формула проекта.
 *
 * refuel считается только по расходам ЭТОГО рейса.
 */
export function computeFuelLevel(
  trip: FuelTripRow,
  fuelExpenses: FuelExpenseRow[]
): FuelLevel {
  const start = trip.start_fuel_level ?? 0;
  const refuel = totalRefuelLiters(trip.id, fuelExpenses);
  const consumed = trip.actual_liters ?? 0;

  const isEstimate = !(consumed > 0);
  const liters = isEstimate ? start + refuel : start + refuel - consumed;

  return {
    liters: Math.max(0, round1(liters)),
    isEstimate,
    tripNumber: trip.trip_number,
    date: trip.end_date || trip.start_date,
  };
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

  const latest = pickTripByNumberDesc(numbered);
  if (!latest) return { ...EMPTY };

  return computeFuelLevel(latest, fuelExpenses);
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

/**
 * Рейс с наибольшим номером.
 * Второй аргумент - фильтр (например, «только с датой окончания»).
 * При равных номерах берётся более поздний по дате начала.
 */
export function pickTripByNumberDesc(
  trips: FuelTripRow[],
  filter?: (t: FuelTripRow) => boolean
): FuelTripRow | null {
  const rows = filter ? trips.filter(filter) : trips;
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => {
    const byNumber = tripNumberValue(b.trip_number) - tripNumberValue(a.trip_number);
    if (byNumber !== 0) return byNumber;
    // номера равны или нечисловые - сравниваем по дате начала
    return String(b.start_date || '').localeCompare(String(a.start_date || ''));
  });

  return sorted[0];
}

/**
 * Предыдущий рейс машины относительно текущего.
 *
 * Берётся рейс с наибольшим номером, кроме текущего.
 * Приоритет - завершённые рейсы (с end_date): остаток после них
 * известен точно. Если завершённых нет - берётся последний рейс
 * машины, но его остаток считается как оценка (isEstimate).
 */
export function pickPreviousTrip(
  trips: FuelTripRow[],
  currentTripId: string
): FuelTripRow | null {
  const others = trips.filter((t) => t.id !== currentTripId && t.trip_number != null);
  if (others.length === 0) return null;

  const finished = pickTripByNumberDesc(others, (t) => t.end_date != null);
  if (finished) return finished;

  return pickTripByNumberDesc(others);
}

/** Литры для показа: "233,5" / "180" / "—" */
export function formatLiters(liters: number | null): string {
  if (liters == null) return '—';
  return liters.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
}
