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
5. **Уже переведено на RLS-клиент** (RLS реально ограничивает выборку): драйверские страницы `app/driver/*` (фаза 33), `lib/session.ts` и `lib/driver-access.ts` (фаза 38).
6. **Менеджер — `scopedClient()`** (`lib/supabase/scoped.ts`): заказы и их содержимое (`trips`, `trip_segments`, `trip_expenses`, `trip_cargo`, `trip_documents`, `trip_segment_cargo`) менеджеру отдаёт RLS-клиент, офису — admin. Справочники — admin, как раньше. Все страницы, поиск и DOCX, которые открывает менеджер, перечислены в `lib/__tests__/scoped-client-guard.test.ts` (сторож); новая — туда же. Действия по заказу и расходу: `requireTripAccess` / `requireExpenseAccess` — видимость менеджеру считает база. Исключения на admin намеренно: остаток топлива тягача (`lib/fuel-server.ts`, нужен весь пробег машины) и проверка пересечений рейсов (`/api/trips/check-overlap`, машина общая).

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

1. **Проверка доступа — только через `can(role, 'right.capability')`.** Не сравнивать `role` со строкой. На странице: `const denied = deniedRedirect(role, 'clients.view'); if (denied) redirect(denied);`. Подпись роли — `roleLabel(role)`, «это водитель?» — `isDriverRole(role)`. Сторож — `lib/__tests__/roles-capabilities.test.ts` (исключения: `lib/roles.ts`, `lib/access-rules.ts`, `lib/driver-access.ts`, где роль — уже нормализованный тип).
2. **Путь → право — только через `capabilityForRequest(pathname, method)`.** Учитывает метод: для записи может требоваться более строгое право, чем для чтения.
3. **Новое право** — добавить в `CAPABILITIES` и выдать нужным ролям в `ROLE_CAPABILITIES`. Проверки в файлах не трогаем.
4. **Право ≠ раздел.** У водителя `reminders.view` — для своего `/driver/reminders`; общая `/reminders` требует `reminders.viewAll`. Страница, которая **не** применяет скоуп менеджера (`lib/scope.ts`), требует право `*.viewAll`, которого у менеджера нет (`reports.viewAll`).
5. **Новая роль** — завести в `ROLE_CAPABILITIES`. Роли `logistics`, `accountant`, `client` заведены, но правила доступа для них ещё не определены, поэтому профили их не получают.
6. Страницы под `/trips` и `/routes` защищены централизованно через `proxy.ts` — дублировать проверки в самих страницах не нужно.
7. `admin` и `manager` из старых профилей в БД работают как `office` (`ROLE_ALIASES`) — миграция базы не требуется.
8. Не импортировать `admin.ts` в client components — Next заблокирует сборку, это намеренная защита.
9. **Каждый server action проверяет доступ сам** (`requireCapability`, `requireOffice`, `requireTripAccess`…): `proxy.ts` проверяет путь страницы, а экшен — отдельный эндпоинт. Сторож — `lib/__tests__/server-actions-guard.test.ts`: падает на экшене без проверки. Публичные по смыслу — в его `PUBLIC_ACTIONS` с причиной.

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

## Выборки из растущих таблиц

PostgREST отдаёт **не больше 1000 строк** на запрос и **молча** обрезает остальное (`error` пустой). А `.in('trip_id', ids)` кладёт все id в URL и на сотнях заказов падает по длине адреса.

| Запрос | Как писать |
|---|---|
| вся таблица или фильтр без верхней границы (`trips`, `trip_expenses`, `trip_segments`, `trip_cargo`, `reminders`, …) | `await fetchAll(supabase.from(...).select(...))` |
| по списку id | `await fetchAllByIds(ids, (chunk) => supabase.from(...).select(...).in('trip_id', chunk))` |
| одна строка / по одному `id` / с `.limit()` | как обычно |

Хелперы — `lib/fetch-all.ts`. Результат той же формы `{ data, error }`, при ошибке на любой странице — `data: null`.

## Языки интерфейса (i18n)

Языки: русский (эталон), польский, английский, украинский — `lib/i18n/config.ts`. Язык выбирает пользователь (переключатель в меню и на входе), хранится в cookie `locale` и `profiles.locale`.

| Где | Как |
|---|---|
| server component / action / route | `const { t } = await getT();` (`lib/i18n/server.ts`) |
| client component | `const { t } = useT();` (`app/components/I18nProvider.tsx`) |
| словари | `lib/i18n/messages/{ru,pl,en,uk}.ts`, ключ `раздел.ключ`, подстановки `{name}` |

### Правила

1. **Новый текст интерфейса — только через `t()`**, ключ — во **все четыре** словаря. Пропущенный ключ ломает `tsc` (словари типизированы по `ru.ts`).
2. **Переведённый раздел — добавить его файлы в `TRANSLATED_FILES`** (`lib/__tests__/i18n.test.ts`): сторож падает, если там снова появится русский текст.
3. Функции в `lib/` возвращают **коды**, а не готовые фразы (пример: `parseCompanyForm` → `'name' | 'email' | 'bot'`): текст подбирает страница на языке пользователя.
4. Не переводятся: данные из базы, записи журнала аудита, `console.*`, документы для перевозчика (DOCX — польский по требованию рынка).
5. **Сообщения водителю** (задание в Telegram, текст для копирования) — на языке водителя, а не того, кто нажал кнопку: `const { t } = await getDriverT(driverId)` (`lib/driver-locale.ts`, язык из `profiles.locale` водителя).

## Внешние сервисы клиента — модулями

У каждой транспортной компании свои программы. Интеграции — через общий интерфейс, модуль на сервис, выбор — переменной окружения проекта клиента.

| Что | Интерфейс и выбор | Модули |
|---|---|---|
| Фактуры | `lib/invoicing/` — `InvoiceProvider`, `getInvoiceProvider()` (`INVOICING_PROVIDER`) | `fakturowo`, `fakturownia` |
| GPS | `lib/gps/` — `GpsProvider`, `getGpsProvider()` (`GPS_PROVIDER`); расчёт пробега и топлива — `lib/gps/metrics.ts` | `logisat` |
| KSeF (входящие) | `lib/ksef/` — напрямую, токен только на чтение | — |
| Почта (письма клиентам) | `lib/mail/` — `MailProvider`, `getMailProvider()` (`MAIL_PROVIDER`) | `smtp` (ящик компании) |

### Правила

1. **Код вне модуля не знает имени сервиса.** Никаких `process.env.LOGISAT_*` / прямых URL сервиса в страницах и роутах — только через провайдера.
2. **Модуль переводит данные в общие единицы** (`GpsPoint`: метры, литры; `RemoteInvoice`, `InvoiceSnapshot`), расчёты — общие и покрыты тестами.
3. **Новый сервис:** файл модуля + строка в `index.ts` + тест на HTTP-заглушке (`*_API_URL` для подмены адреса).
4. Колонки `trucks.logisat_device_id` / `logisat_enabled` и пути `/logisat`, `/api/logisat/*` — исторические имена: это ID устройства и раздел GPS любого сервиса.

## Миграции

Применяются **автоматически** — `.github/workflows/migrate.yml` (настройка — `docs/RELEASES.md`). SQL Editor больше не нужен.

| Когда | Куда |
|---|---|
| PR с файлом в `supabase/migrations/` | staging (`STAGING_DATABASE_URL`), если задан |
| merge в `master` | прод: ждёт деплой Vercel → план → подтверждение в GitHub → применяет |
| Actions → Migrations → Run workflow | план (dry run) или применение вручную |

### Правила

1. **Порядок релиза: код → деплой → миграции.** Значит, миграция обязана работать со **старым** кодом: добавлять колонки/таблицы — да; удалять, переименовывать, менять тип, `set not null` — только **отдельным PR**, когда код уже не читает старое. Такая миграция помечается строкой `-- contract: <почему безопасно>`. Сторож — `lib/__tests__/migrations-safe.test.ts`.
2. **Новый код терпит отсутствие новой колонки** несколько минут между деплоем и миграцией (повтор select без неё, как в `lib/receivables-load.ts`) — или фича просто не видна, пока миграции нет.
3. Каждая миграция **идемпотентна** (`if not exists`, `create or replace`) — CI применяет их дважды (`rls.yml`).
4. Файл после применения **не менять** — только новой миграцией (журнал хранит checksum и предупредит).
