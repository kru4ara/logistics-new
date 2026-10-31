/**
 * Единая модель заказа (бывшие «рейсы» + «экспедирование»).
 *
 * Зафиксировано 31.10.2026:
 *
 * 1. РЕЖИМ РАСЧЁТА (profit_mode) задаёт математику:
 *    - 'trip'       — рейс;
 *    - 'forwarding' — экспедирование.
 *    Галочка «Экспедирование» (is_forwarding) — пометка происхождения,
 *    а НЕ переключатель математики.
 *
 * 2. НУМЕРАЦИЯ плотная, без дыр, как в рейсах сейчас:
 *    - рейс       -> '42'
 *    - экспедиция-> '42Е'
 *    - без назначенного исполнителя -> null (номера нет)
 *    Ветки независимы: рейсы 1..N, экспедиции 1Е..NЕ.
 *
 * 3. СТАТИСТИКА: только завершённые заказы со сведёнными расходами.
 *    Завершённый = 'paid' или 'invoiced'.
 *    Незавершённый = 'active' (в пути), 'planned' или null.
 *
 * 4. МЕСЯЦ заказа — ПО ДАТЕ ВЫГРУЗКИ:
 *    - 'trip'       -> end_date || start_date (финиш)
 *    - 'forwarding' -> unload_date || load_date (разгрузка)
 *    Загружен в сентябре, выгружен в октябре — заказ октябрьский.
 *    По этой же дате идёт сортировка и нумерация.
 *
 * 5. ЧИСТАЯ ПРИБЫЛЬ = Прибыль1 + Прибыль2 − общие затраты, БЕЗ CAPEX.
 *    Годовые общие затраты падают целиком в месяц оплаты.
 */

export const FORWARDING_SUFFIX = 'Е';

export type ProfitMode = 'trip' | 'forwarding';

/** Статусы, при которых заказ завершён и попадает в статистику. */
export const COMPLETED_STATUSES = ['paid', 'invoiced'] as const;

/** Статусы незавершённых заказов: в пути, запланирован. */
export const OPEN_STATUSES = ['active', 'planned'] as const;

/** Число, пригодное для арифметики. */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type OrderEconomics = {
  revenue: number;
  contractorExpenses: number;
  otherExpenses: number;
  profit: number;
  marginPct: number;
};

/** Единая точка расчёта экономики заказа. */
export function calcOrderEconomics(data: {
  revenue: number;
  contractorExpenses: number;
  otherExpenses: number;
}): OrderEconomics {
  const revenue = num(data.revenue);
  const contractorExpenses = num(data.contractorExpenses);
  const otherExpenses = num(data.otherExpenses);
  const profit = revenue - contractorExpenses - otherExpenses;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, contractorExpenses, otherExpenses, profit, marginPct };
}

/** Номер заказа по режиму: '42' для рейса, '42Е' для экспедиции. */
export function formatOrderNumber(base: number, mode: ProfitMode): string {
  return mode === 'forwarding' ? base + FORWARDING_SUFFIX : String(base);
}

/** Отделяет числовую часть номера от суффикса. */
export function parseOrderNumber(value: string | null | undefined): {
  number: number | null;
  isForwarding: boolean;
} {
  if (!value) return { number: null, isForwarding: false };
  const trimmed = String(value).trim();
  const isForwarding = trimmed.endsWith(FORWARDING_SUFFIX);
  const digits = isForwarding ? trimmed.slice(0, -1) : trimmed;
  const n = parseInt(digits, 10);
  return { number: Number.isFinite(n) ? n : null, isForwarding };
}

/**
 * Сортировка внутри ветки нумерации — по дате ВЫГРУЗКИ ASC
 * (рейс — финиш, экспедиция — разгрузка), при равенстве по дате
 * создания ASC. Так же работает renumber_all_trips в БД.
 */
export function orderByNumberingDate<T extends {
  profit_mode?: ProfitMode | null;
  start_date?: string | null;
  end_date?: string | null;
  load_date?: string | null;
  unload_date?: string | null;
  created_at?: string | null;
}>(a: T, b: T): number {
  const da = getOrderUnloadDate(a);
  const db = getOrderUnloadDate(b);
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!db && da) return 1;
  const ca = a.created_at || '';
  const cb = b.created_at || '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  return 0;
}

/**
 * Заказ рабочий (получает номер), только если назначен исполнитель.
 * Для рейса — наш транспорт с водителем, для экспедиции — подрядчик.
 */
export function hasAssignedExecutor(order: {
  executor_type?: string | null;
  truck_id?: string | null;
  driver_id?: string | null;
  contractor_id?: string | null;
}): boolean {
  if (order.executor_type === 'us') {
    return Boolean(order.truck_id && order.driver_id);
  }
  if (order.executor_type === 'contractor') {
    return Boolean(order.contractor_id);
  }
  return false;
}

/**
 * Плотная нумерация 1..N в пределах ветки, без дыр.
 * Без назначенного исполнителя — номер null, счётчик не сдвигается.
 */
export function renumberOrders<T extends {
  id: string;
  profit_mode?: ProfitMode | null;
  start_date?: string | null;
  end_date?: string | null;
  load_date?: string | null;
  unload_date?: string | null;
  created_at?: string | null;
  executor_type?: string | null;
  truck_id?: string | null;
  driver_id?: string | null;
  contractor_id?: string | null;
}>(orders: T[], mode: ProfitMode): Array<{ id: string; trip_number: string | null }> {
  const sorted = [...orders].sort(orderByNumberingDate);
  const result: Array<{ id: string; trip_number: string | null }> = [];
  let counter = 0;
  for (const o of sorted) {
    if (!hasAssignedExecutor(o)) {
      result.push({ id: o.id, trip_number: null });
      continue;
    }
    counter += 1;
    result.push({ id: o.id, trip_number: formatOrderNumber(counter, mode) });
  }
  return result;
}

/** Заказ завершён и пригоден для статистики. */
export function isOrderCompleted(order: {
  status?: string | null;
  costs_closed?: boolean | null;
}): boolean {
  if (!order.status) return false;
  if (!(COMPLETED_STATUSES as readonly string[]).includes(order.status)) return false;
  return order.costs_closed === true;
}

/**
 * Ключ месяца заказа. Правило зависит от режима расчёта.
 * null, если нет ни одной подходящей даты.
 */
export function getOrderMonthKey(
  order: {
    profit_mode?: ProfitMode | null;
    start_date?: string | null;
    end_date?: string | null;
    load_date?: string | null;
    unload_date?: string | null;
  },
  fallbackMode: ProfitMode = 'trip'
): string | null {
  const raw = getOrderUnloadDate(order, fallbackMode);
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/**
 * Дата выгрузки заказа — по ней определяются месяц заказа,
 * сортировка и нумерация.
 *   рейс       -> end_date (финиш), запасной start_date
 *   экспедиция -> unload_date (разгрузка), запасной load_date
 * Загружен в сентябре, выгружен в октябре — заказ октябрьский.
 */
export function getOrderUnloadDate(
  order: {
    profit_mode?: ProfitMode | null;
    start_date?: string | null;
    end_date?: string | null;
    load_date?: string | null;
    unload_date?: string | null;
  },
  fallbackMode: ProfitMode = 'trip'
): string | null {
  const mode: ProfitMode = order.profit_mode === 'forwarding' ? 'forwarding' : fallbackMode;
  return mode === 'forwarding'
    ? order.unload_date || order.load_date || null
    : order.end_date || order.start_date || null;
}

/**
 * Сортировка по номеру заказа ЧИСЛЕННО.
 * Нужна потому, что trip_number стал text: наивный orderBy дал бы
 * «10» перед «2». Суффикс «Е» на порядок внутри ветки не влияет.
 */
export function compareOrderNumbers(a: string | null, b: string | null): number {
  const na = parseOrderNumber(a).number;
  const nb = parseOrderNumber(b).number;
  if (na === null && nb === null) return 0;
  if (na === null) return 1;
  if (nb === null) return -1;
  return na - nb;
}
