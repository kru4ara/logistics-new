<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Клиенты Supabase

Три клиента, роли строго разные. Не смешивать.

| Файл | Ключ | Права | RLS | Где применять |
|---|---|---|---|---|
| `lib/supabase/admin.ts` | `service_role` | полные, обходит RLS | ❌ обходит | server components, route handlers, server actions — только когда нужны права админа |
| `lib/supabase/server.ts` | anon + cookies | текущий пользователь | ✅ действует | запросы от имени залогиненного пользователя |
| `lib/supabase/client.ts` | anon | браузер | ✅ действует | client components |

### Правила

1. **По умолчанию — `lib/supabase/server.ts`.** Он работает от имени пользователя и уважает Row Level Security.
2. **`lib/supabase/admin.ts` — только когда действительно нужны права админа** (миграции, фоновые задачи, выборки по чужому `driver_id`). Файл содержит `import 'server-only'` — в клиентский бандл не попадёт.
3. **RLS в базе ВКЛЮЧЁН** — миграции `20261029_001`–`004` применены, политики живут в `supabase/migrations/`. Выборка через `admin.ts` **не ограничена ничем**: `service_role` обходит RLS, поэтому через admin-клиент водитель видит столько же, сколько офис. RLS работает **только там, где используется `server.ts`**.
4. `lib/supabase/client.ts` удалён — браузерных запросов к Supabase в проекте нет, всё идёт через server components / server actions.
5. **Уже переведено на RLS-клиент** (RLS реально ограничивает выборку): драйверские страницы `app/driver/*` (фаза 33), `lib/session.ts` и `lib/driver-access.ts` (фаза 38). Остальные ~88 файлов всё ещё идут через `service_role` — это следующая очередь.

## Права доступа (capabilities)

Проверять роль строкой (`role === 'admin'`) — ловушка: новая роль потребует правок в десятке мест, и одно забытое место = дыра. Поэтому проверяем **право (capability)**, а матрица отображает роль → набор прав.

Единый источник правды — **`lib/roles.ts`**.

| Что | Где |
|---|---|
| Список всех прав | `CAPABILITIES` |
| Матрица роль → права | `ROLE_CAPABILITIES` |
| Право для пути (чтение/запись) | `PATH_CAPABILITIES` |
| Синонимы ролей из БД | `ROLE_ALIASES` |

### Правила

1. **Проверка доступа — только через `can(role, 'right.capability')`.** Не сравнивать `role` со строкой в новом коде.
2. **Путь → право — только через `capabilityForRequest(pathname, method)`.** Учитывает метод: для записи может требоваться более строгое право, чем для чтения.
3. **Новое право** — добавить в `CAPABILITIES` и выдать нужным ролям в `ROLE_CAPABILITIES`. Проверки в файлах не трогаем.
4. **Новая роль** — завести в `ROLE_CAPABILITIES`. Роли `logistics`, `accountant`, `client` заведены, но правила доступа для них ещё не определены, поэтому профили их не получают.
5. Страницы под `/trips` и `/routes` защищены централизованно через `proxy.ts` — дублировать проверки в самих страницах не нужно.
6. `admin` и `manager` из старых профилей в БД работают как `office` (`ROLE_ALIASES`) — миграция базы не требуется.
7. Не импортировать `admin.ts` в client components — Next заблокирует сборку, это намеренная защита.

## Проверки доступа к рейсу и расходу

Единая точка входа — **`lib/driver-access.ts`**: `requireTripAccess(tripId)` и `requireExpenseAccess(expenseId)`. Вызывать её из любого server action, который пишет по `trip_id`, пришедшему из клиента.

| Файл | Что делает |
|---|---|
| `lib/session.ts` | роль и `driver_id` актора. Читает `profiles` через RLS-клиент, при сбое — откат на admin (строго одна строка по `id = user.id`) |
| `lib/driver-access.ts` | проверка доступа к рейсу и расходу. Водитель читает через RLS-клиент, офис — через admin |
| `lib/access-rules.ts` | **чистые** правила доступа без Supabase — только их можно покрыть юнит-тестами |

### Правила

1. **Правило владения живёт в БД**, а не в TypeScript. Политика `public.driver_owns_trip()` считает владением и рейс целиком (`trips.driver_id`), и назначение хотя бы на один сегмент (`trip_segments.driver_id`). Не дублировать эту логику в коде: при расхождении кода и БД водитель получает отказ на свою же сущность.
2. **Новую проверку доступа писать в `lib/access-rules.ts`**, а не внутри `driver-access.ts` — иначе её нечем покрыть тестом.
3. **Офисный путь остаётся на admin-клиенте:** офис читает всё, RLS для него ничего не даёт, а перевод добавил бы риск без выигрыша. RLS-клиент — только там, где ограничение что-то даёт.
