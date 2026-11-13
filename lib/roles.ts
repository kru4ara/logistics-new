/**
 * Роли и права — единый источник правды.
 *
 * Проверять роль строкой ('admin', 'driver') в разных местах — ловушка:
 * при появлении новой роли придётся править десяток файлов, и одно
 * забытое место = дыра в доступе. Поэтому проверяем capability (право),
 * а матрица ниже отображает роль -> набор прав.
 *
 * Роли сейчас: office (офис), manager (менеджер), driver (водитель).
 * Заведены впрок: logistics, accountant, client — правила доступа для них
 * пока не финализированы, поэтому реальные профили их не получают.
 *
 * ВАЖНО: роль 'admin' из старых профилей в БД продолжит работать —
 * см. ROLE_ALIASES.
 */

export const CAPABILITIES = [
  // Рейсы
  'trips.view',
  'trips.viewAll',
  'trips.create',
  'trips.editAny',
  // Деньги
  'expenses.view',
  'expenses.edit',
  'fixedCosts.view',
  'fixedCosts.edit',
  'rates.manage',
  // Справочники
  'clients.view',
  'clients.edit',
  'drivers.view',
  'drivers.edit',
  'contractors.view',
  'contractors.edit',
  'locations.view',
  'locations.edit',
  'trucks.view',
  'trucks.edit',
  // Менеджеры
  'managers.view',
  'managers.edit',
  // Аналитика и отчёты
  'reports.view',
  'statistics.view',
  'audit.view',
  'search.view',
  'export.view',
  // Прочее
  'logisat.view',
  'logisat.sync',
  'map.view',
  'today.view',
  'reminders.view',
  'reminders.edit',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const OFFICE: Capability[] = [...CAPABILITIES];

const DRIVER: Capability[] = [
  'trips.view',
  'expenses.view',
  'expenses.edit',
  'logisat.view',
  'reminders.view',
];

/**
 * Менеджер — офис без трёх вещей:
 *
 *   1. без доступа к аудиту (audit.view) и экспорту в Excel (export.view);
 *   2. без раздела «Менеджеры» (managers.view / managers.edit) —
 *      менеджер сам себе не назначает менеджеров, это делает офис;
 *   3. без ЧУЖИХ заказов: менеджер видит только заказы, назначенные на
 *      него, и заказы без назначенного менеджера (общий пул офиса).
 *
 * Третий пункт обеспечивается не правами, а скоупом данных —
 * см. lib/scope.ts. Права определяют, куда менеджер вообще может
 * зайти, скоуп — что он там увидит.
 */
const MANAGER: Capability[] = OFFICE.filter(
  (c) => c !== 'audit.view' && c !== 'export.view' && c !== 'managers.view' && c !== 'managers.edit'
);

export const ROLE_CAPABILITIES: Record<string, Capability[]> = {
  office: OFFICE,
  manager: MANAGER,
  driver: DRIVER,
};

export const ADMIN_ROLES = ['office'] as const;

/**
 * Старые значения ролей в БД -> актуальные.
 *
 * ВНИМАНИЕ: 'manager' больше НЕ является синонимом офиса.
 * Раньше manager -> office, и роль 'manager' в БД означала офис.
 * Теперь 'manager' — это отдельная роль менеджера по логистике
 * (см. миграцию 20261111_012_managers.sql), и её права отличаются
 * от офисских.
 *
 * Перевод старых профилей с role='manager' на 'office' делает
 * миграция 012: иначе прежний офис-менеджер потерял бы доступ.
 */
const ROLE_ALIASES: Record<string, string> = {
  admin: 'office',
};

export function normalizeRole(role: string | null | undefined): string {
  const raw = String(role ?? '').trim().toLowerCase();
  return ROLE_ALIASES[raw] ?? raw;
}

export function can(role: string | null | undefined, capability: Capability): boolean {
  const caps = ROLE_CAPABILITIES[normalizeRole(role)];
  return caps ? caps.includes(capability) : false;
}

export function canAny(
  role: string | null | undefined,
  capabilities: Capability[]
): boolean {
  return capabilities.some((c) => can(role, c));
}

export function isDriverRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'driver';
}

export function isOfficeRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'office';
}

/** Менеджер по логистике — не офис, но и не водитель. */
export function isManagerRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'manager';
}

/**
 * Какие поля обновлять в profiles при привязке учётной записи к менеджеру.
 *
 * Проблема: роль 'manager' — это офис минус managers.view/managers.edit,
 * audit.view и export.view (см. MANAGER выше). Если привязать менеджера
 * к учётной записи, которая одновременно является рабочей офисной, и
 * вслепую проставить role='manager', человек теряет доступ к админским
 * разделам — и больше не может ни открыть раздел «Менеджеры», ни
 * отвязать себя.
 *
 * Поэтому роль понижаем только у тех профилей, которые офисными не
 * являются. Ссылка на карточку (manager_id) проставляется в любом
 * случае: по ней определяется скоуп менеджера (lib/scope.ts).
 *
 * Чистая функция — чтобы правило можно было покрыть юнит-тестом без
 * сервера и БД (как lib/scope-rules.ts).
 */
export function managerProfileUpdate(
  currentRole: string | null | undefined,
  managerId: string
): { role?: string; manager_id: string } {
  const normalized = normalizeRole(currentRole);
  const isOfficeProfile = normalized === 'office';
  return isOfficeProfile
    ? { manager_id: managerId }
    : { role: 'manager', manager_id: managerId };
}

export interface PathRule {
  prefix: string;
  /** право для чтения (GET) */
  capability: Capability;
  /** право для записи (POST/PUT/PATCH/DELETE); если нет — capability */
  writeCapability?: Capability;
}

export const PATH_CAPABILITIES: PathRule[] = [
  { prefix: '/reports', capability: 'reports.view' },
  { prefix: '/statistics', capability: 'statistics.view' },
  { prefix: '/audit', capability: 'audit.view' },
  { prefix: '/fixed-costs', capability: 'fixedCosts.view', writeCapability: 'fixedCosts.edit' },
  { prefix: '/trips', capability: 'trips.viewAll', writeCapability: 'trips.editAny' },
  { prefix: '/routes', capability: 'trips.viewAll' },
  { prefix: '/search', capability: 'search.view' },
  { prefix: '/clients', capability: 'clients.view', writeCapability: 'clients.edit' },
  { prefix: '/contractors', capability: 'contractors.view', writeCapability: 'contractors.edit' },
  { prefix: '/drivers', capability: 'drivers.view', writeCapability: 'drivers.edit' },
  { prefix: '/managers', capability: 'managers.view', writeCapability: 'managers.edit' },
  { prefix: '/trucks', capability: 'trucks.view', writeCapability: 'trucks.edit' },
  { prefix: '/locations', capability: 'locations.view', writeCapability: 'locations.edit' },
  { prefix: '/reminders', capability: 'reminders.view', writeCapability: 'reminders.edit' },
  { prefix: '/today', capability: 'today.view' },
  { prefix: '/map', capability: 'map.view' },
  { prefix: '/api/export', capability: 'export.view' },
  { prefix: '/api/logisat/query', capability: 'logisat.view' },
  { prefix: '/api/logisat', capability: 'logisat.sync' },
  { prefix: '/api/backfill-rates', capability: 'rates.manage' },
  { prefix: '/api/update-rates', capability: 'rates.manage' },
  { prefix: '/api/check-duplicates', capability: 'trips.viewAll' },
  { prefix: '/api/trips', capability: 'trips.viewAll', writeCapability: 'trips.editAny' },
];

/**
 * Право, требуемое для запроса к пути.
 * Учитывает метод: для записи может требоваться более строгое право.
 */
export function capabilityForRequest(
  pathname: string,
  method: string = 'GET'
): Capability | null {
  const rule = PATH_CAPABILITIES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(prefix + '/')
  );
  if (!rule) return null;
  if (method !== 'GET' && method !== 'HEAD' && rule.writeCapability) {
    return rule.writeCapability;
  }
  return rule.capability;
}

export function capabilityForPath(pathname: string): Capability | null {
  return capabilityForRequest(pathname, 'GET');
}

/**
 * Пути, у которых нет правила в PATH_CAPABILITIES, но которые нужны
 * любой роли: главная (редиректит по роли), раздел водителя, вход и
 * статика PWA.
 *
 * Всё остальное без правила — только офис и менеджер (см.
 * canUseUnlistedPath). Раньше путь без правила пропускался ЛЮБОМУ
 * залогиненному, включая водителя: новая страница без записи в
 * PATH_CAPABILITIES молча становилась открытой.
 */
const OPEN_EXACT_PATHS = ['/', '/manifest.webmanifest', '/icon.svg', '/apple-icon.svg'];
const OPEN_PATH_PREFIXES = ['/driver', '/login'];

export function isOpenToAllRoles(pathname: string): boolean {
  if (OPEN_EXACT_PATHS.includes(pathname)) return true;
  return OPEN_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );
}

/** Путь без правила: пускаем только офис и менеджера, водителя — нет. */
export function canUseUnlistedPath(role: string | null | undefined): boolean {
  return isOfficeRole(role) || isManagerRole(role);
}
