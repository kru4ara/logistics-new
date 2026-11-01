# HANDOVER — Logistics CRM (01.11.2026)

## Стек и инфраструктура
- **Next.js 16.4.3** (App Router, Turbopack) + React 19.3.1 + Supabase + Vercel
- **Tailwind CSS 4.3.3** (конфигурация через CSS `@theme`, без `tailwind.config.js`)
- GitHub: `kru4ara/logistics-new` (master) 
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: `logistics-core`, org `Raibuilding`
  - ⚠️ **ПРАВИЛЬНЫЙ REF:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i` после `smodijsj`)
  - ❌ **ОШИБОЧНЫЙ:** `smodijsjwvsscfgloh` (без `i`) → NXDOMAIN
  - **Правило:** копировать ТОЛЬКО кнопкой Copy из Settings → General.
- Vercel project: `kru4aras-projects/logistics-new`

### ENV (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — клиент, RLS закрыт
- `SUPABASE_SERVICE_ROLE_KEY` — server client, обходит RLS
- `LOGISAT_SERVER` / `LOGISAT_USERNAME` / `LOGISAT_PASSWORD`
- `TELEGRAM_BOT_TOKEN` — @raibuilding_bot
- `TELEGRAM_CHAT_ID` — `921520481`
- `TELEGRAM_WEBHOOK_SECRET` — ✅ **задан** (проверено 26.10)
- `CRON_SECRET` — ✅ **задан** (проверено 26.10)

---

## 🚨 Vercel Hobby Лимит и GitHub Outage
Если Vercel не запускает билды после `git push`:
1. Ждать 24 часа.
2. `git commit --allow-empty -m "trigger"` + `git push`.
3. Redeploy вручную.

---

## ⚠️ Строгое правило работы с кодом (Важно!)
- **Изменения в коде вносятся ТОЛЬКО через веб-интерфейс GitHub.**
- Локальный VS Code не используется для правок (файлы не сохраняются/не применяются).
- Терминал используется **ТОЛЬКО** для команд: `git pull`, `git push`, `git merge`, `npm install`, `npm run lint`, `npm run test`, `git status`, `git log`.
- Любые инструкции от AI должны содержать **точный путь к файлу** и **точные строки**, которые нужно заменить, чтобы их можно было применить в веб-редакторе GitHub.
- После правок на GitHub, перед запуском тестов/линта локально, **всегда** делать `git pull`.

### Контекст чата — не бесконечный
Не грузить бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.

### Рабочий процесс (Next.js 16)
- Полные файлы на замену, не куски.
- 1 шаг за раз.
- Server components → `createClient()` из `lib/supabase-server` (admin) или `lib/supabase/server` (с сессией).
- **ВСЕГДА** `await cookies()` и `await searchParams`.
- **Один коммит = связанные файлы.**
- **`import` должны быть в начале файла.**
- **`middleware.ts` переименован в `proxy.ts`** (Next 16). В `next.config.js` **нет** ключа `eslint`.
- **Линт** — отдельный файл `eslint.config.mjs`: `@eslint/js` + `typescript-eslint` + готовый flat-конфиг **`eslint-config-next`** (`...next`), который подключает `react`, `react-hooks`, `jsx-a11y`, `import` и `@next/next` вместе с их recommended-правилами. Ручного подключения react-плагинов в devDependencies нет — они приезжают транзитивно.

### ⚠️ Git (локально)
- `git pull --no-edit`.
- При `rejected` — `git pull --no-edit`, потом `git push`.
- Конфликт в `package.json` — **наша версия**.
- **Git Bash склеивает команды** — по одной строке.
- **`sed` на JSX — запрещён.**
- Защита ветки `master` **не настроена** (осознанное решение для удобства).

---

## 📁 Структура проекта

### Гибкая модель рейсов
**`trip_cargo`** — грузы (фрахт, вес, паллеты, таможня).
**`trip_segments`** — участки (исполнитель, машина, водитель, цена).
**`trip_expenses`** — расходы.
**`counters`** — нумерация.
**`profiles`** — роль (`admin` | `driver`) и `driver_id`.

### Supabase Auth
- `lib/supabase/admin.ts` (admin, `service_role`, `server-only`) — обходит RLS
- `lib/supabase/server.ts` (с сессией, anon + cookies) — RLS действует
- `lib/supabase/client.ts` — **удалён**, браузерных запросов к Supabase нет
- `lib/session.ts` — `getSessionContext()`: единый источник роли и `driver_id` (таблица `profiles`, куки только для совместимости с UI)
- `proxy.ts` (бывший middleware) — **проверка прав по capability**, не белый список ролей; cron и вебхуки — публичные
- `app/login/actions.ts` — вход через `signInWithPassword`

### Права доступа (`lib/roles.ts`)
- **37 capability**, матрица роль → права: `office` (все), `driver` (5).
- Проверка — только `can(role, 'cap.capability')`. Путь → право — `capabilityForRequest(pathname, method)` (отдельно на чтение и запись).
- `ROLE_ALIASES`: `admin`/`manager` из старых профилей БД → `office`, миграция не нужна.
- `/trips` и `/routes` прикрыты централизованно через `proxy.ts` (включая `/trips/[id]`, `/trips/new`, `/trips/[id]/edit`, `/routes/export` — раньше они были без единой проверки).
- Роли `logistics`, `accountant`, `client` заведены в коде, но не выдаются никому — правила доступа для них не определены (п. «Очередь задач»).

### Хелперы (`lib/`)
- `trip-route.ts`, `trip-task-text.ts`, `trip-renumber.ts`, `statistics.ts`, `profitability.ts`, `geocode.ts`, `translate-pl.ts`, `company.ts`, `audit.ts`, `cron-alert.ts`, `telegram.ts`.

### Разбитые гиганты
- `SegmentForm.tsx` → `SegmentAddressBlock`, `SegmentStopsBlock`, `SegmentExecutorBlock`, `SegmentCargoSelector`, `types.ts`.
- `statistics/page.tsx` → `lib/statistics.ts` + 6 компонентов.
- `profitability/page.tsx` → `lib/profitability.ts` + тесты.
- `trips/[id]/page.tsx` → `TripHeader`, `TripInfo`, `TripEconomics`.
- `drivers/[id]/page.tsx` → `DriverHeader`, `DriverFinance`, `DriverCardDownload`, `DriverStats`, `DriverTrips`.
- `forwarding/[id]/page.tsx` → `ForwardingHeader`, `ForwardingStatusBlock`, `ForwardingEconomics`, `ForwardingClient`, `ForwardingPoints`, `ForwardingContractors`, `ForwardingDetails`, `ForwardingExpenses`.

---

## 🔒 Закрытые фазы

### Фазы 3.1–3.6 — legacy cleanup, переход на `trip_segments`
### Фаза 4 — Расчёты с водителями
### Фаза 5 — Груз первичен (заявка создает trip + trip_cargo)
### Фаза 6 — Утилиты и защита (логирование, напоминания, топливо)
### Фаза 7 — KPI водителей с прибылью
### Фаза 8 — Merge tool для подрядчиков — ✅ 21.10
### Фаза 9 — Фильтры на `/reports` — ✅ 21.10
### Фаза 10 — Оптимизация бандла и аудит безопасности — ✅ 21.10
### Фаза 11 — Миграция на Next.js 15 + React 19 — ✅ 21.10
### Фаза 12 — Рефакторинг карточки рейса и UI — ✅ 22.10
### Фаза 13 — Аудит зависимостей и миграция линтера — ✅ 22.10
### Фаза 14 — Ремонт линта (54 ошибки → 0) — ✅ 23.10
### Фаза 15 — Миграция на `exceljs` — ✅ 24.10
### Фаза 16 — Проверка производительности и безопасности — ✅ 24.10
### Фаза 17 — Миграция на Supabase Auth — ✅ 24.10
### Фаза 18 — Улучшения UX/UI и PWA — ✅ 25.10
### Фаза 19 — Инфраструктура и тесты — ✅ 25.10
### Фаза 20 — Рефакторинг гигантских файлов — ✅ 25.10
### Фаза 21 — Аудит безопасности (закрытие дыр) — ✅ 26.10
### Фаза 22 — Рефакторинг карточки рейса — ✅ 26.10
### Фаза 23 — Рефакторинг карточки водителя — ✅ 26.10
### Фаза 24 — Рефакторинг карточки экспедирования — ✅ 26.10
### Фаза 25 — Миграция на Next.js 16 — ✅ 26.10
- `next@15.5.28` → **`16.4.3`** (Turbopack по умолчанию).
- `middleware.ts` → **`proxy.ts`** (кодмод).
- `next.config.js`: убран ключ `eslint`.
- `sharp@0.35.5` — безопасная версия (проверено).
- `revalidateTag` — breaking change (пока не используется в проекте).

### Фаза 26 — Наведение порядка в линтере — ✅ 26.10
- `eslint-config-next` **подключён** (PR #16): раньше конфиг был собран вручную, поэтому ни одно правило `@next/next-*` не работало (17 warn + 7 error).
- `eslint.config.mjs` переведён на чистые плагины + `globals` (Node + Service Worker).
- Исправлены все 30 ошибок линта (0 errors, 48 warnings).
- Восстановлен случайно удалённый `app/lib/supabase-server.ts`.
- Ветка `feat/next-16` успешно смержена в `master`.

### Фаза 27 — Миграция на Tailwind 4 — ✅ 26.10
- Обновлены пакеты: `tailwindcss@4.3.3`, `@tailwindcss/postcss`.
- Удалён `tailwind.config.js` (кастомные цвета `brand`, `accent`, `ink`, тени и анимации перенесены в `app/globals.css` через `@theme`).
- `postcss.config.js` переведён на плагин `@tailwindcss/postcss`.
- В `globals.css` директива `@tailwind base;` заменена на `@import "tailwindcss";`.
- Синхронизирован `package-lock.json` (удалены старые `overrides`).

### Фаза 28 — Матрица прав вместо проверок роли — ✅ 29.10
- Новый `lib/roles.ts`: 37 capability, матрица `office`/`driver`, `PATH_CAPABILITIES` (право отдельно на чтение и запись), `ROLE_ALIASES`.
- `proxy.ts` переписан на `capabilityForRequest(pathname, method)`; списки `ADMIN_ONLY_PATHS` и `ADMIN_ROLES` удалены.
- 13 файлов переведены с `role !== 'admin'` на `can(role, ...)`: главная, поиск (страница + actions), экспорт, logisat sync-bulk, trips/routes/logisat/today, check-overlap, driver-docx, Sidebar.
- **Закрыты дыры:** `/trips/[id]`, `/trips/new`, `/trips/[id]/edit`, `/routes/export` не имели ни одной проверки доступа и читали через `admin.ts` (service_role, RLS обходится).
- `manager` больше не в неоднозначном состоянии (проходил proxy, но отлетал на страницах).
- PR #31 смержен в `master` (коммит `0c4ce2a`).
- **Не сделано:** `tsc --noEmit` не прогонялся, ручная проверка ролей не сделана, `AGENTS.md` обновлён только в части прав.

### Фаза 29 — Гарды в Logisat API + разделение правила `/api/logisat/query` — ✅ 29.10
- **Найден баг:** в `PATH_CAPABILITIES` было одно правило на весь префикс — `{ prefix: '/api/logisat', capability: 'logisat.sync' }`. `capabilityForRequest` берёт первое совпадение и для чтения, и для записи, поэтому GET истории топлива `/api/logisat/query` требовал `logisat.sync`. У роли `driver` есть только `logisat.view` — **водительский запрос отрезался полностью**.
- **Исправлено:** `{ prefix: '/api/logisat/query', capability: 'logisat.view' }` вынесено **перед** общим `/api/logisat` (порядок важен — `find` берёт первое совпадение).
- **Гарды в роутах:** `app/api/logisat/query` → `logisat.view` (POST), `app/api/logisat/sync` → `logisat.sync` (POST), `app/api/logisat/test` → `logisat.sync` (GET). Раньше внутри этих трёх роутов авторизации не было вовсе — держались только на префиксе в `proxy.ts`. Эталон — `sync-bulk` (был с гардом).
- **Матрица:** `/api/logisat/query` — driver ✅ / office ✅; `sync`, `test`, `sync-bulk` — driver ❌ / office ✅.
- **Две ошибки в моих скриптах (и уроки):**
  1. Чистка lint-warnings удаляла строку импорта целиком по вхождению имени. В `app/page.tsx` импорт был объединённый `import { can, isDriverRole }` — унёс и `can`, который используется → `TS2304: Cannot find name 'can'`, красный билд. **Урок: неиспользуемые импорты чистить переписыванием импорта, а не вырезанием строки.**
  2. Поиск «последнего импорта» по `startswith('import ')` попал внутрь многострочного `import {` из `lucide-react` → импорт вставлен в тело блока, 5 ошибок парсинга. **Урок: точечные правки импортов делать из файла-основы (master/ветка) заменой одной строки + diff-проверка, а не вставкой по паттерну.**
- PR #32 смержен в `master` (коммиты `9822bc6`, `6ea69b4`, `27f710d`).
- **Проверено:** `tsc --noEmit` — 0 ошибок, `npm run lint` — 0 ошибок 0 warnings, `npm run test` — 28/28, `npm run build` — успешно.
- **CI уже существовал** (`.github/workflows/ci.yml`): lint → tsc → test → build, на `push` в `master` и на `pull_request`. Отдельного добавления не потребовалось.

---

### Фаза 30 — Аудит Supabase-клиентов: 4 точки входа, service_role без RLS — ✅ 29.10
- **Просканированы все** `.ts/.tsx` (100+ файлов): кто и какой клиент импортирует, помечен ли файл `'use client'`.
- **Хорошо:** `lib/supabase/admin.ts` уже помечен `import 'server-only'` → service_role физически не попадает в клиентский бандл. **0 клиентских файлов** импортируют admin-клиент. 90 серверных файлов используют admin, 3 — server-клиент (`app/driver/page.tsx`, `app/driver/trips/[id]/page.tsx`, `app/login/actions.ts`).
- **4 точки входа:** `lib/supabase/admin.ts` (service_role, обходит RLS, `server-only` ✅) · `lib/supabase/server.ts` (anon + куки сессии) · `proxy.ts` (свой `createServerClient` из `@supabase/ssr`) · `lib/session.ts` (оба).
- **Исправлено:** в `lib/supabase/server.ts` добавлен `import 'server-only'` — раньше он был единственным без маркера, безопасность держалась только на том, что его никто не импортировал из клиентского файла. Теперь защита от будущей ошибки, а не от текущей.
- **`proxy.ts` НЕ дубликат и НЕ баг:** в proxy нужен `request.cookies`, в server-клиенте — `cookies()` из `next/headers`. Разные контексты, свести в один модуль нельзя без потери middleware-семантики. Оставлено намеренно.
- **Главный вывод аудита:** 90 файлов ходят в базу через `service_role`, который **обходит RLS**. Права держатся исключительно на проверках в коде (`can(role, ...)` в `proxy.ts` и в роутах). Одна забытая проверка = доступ ко всем таблицам. **Миграция на RLS — самый ценный из оставшихся пунктов: убирает целый класс дыр, а не чинит одну.**
- **Кандидаты на перевод на RLS-клиент первыми:** `app/driver/page.tsx` и `app/driver/trips/[id]/page.tsx` — водительские страницы сейчас получают `service_role` (доступ ко всем таблицам), прикрыто только тем, что они под `/driver` и проверяют `role === 'driver'`.

---

### Фаза 31 — Закрыта дыра с ownership в server-actions (KRITICHNO) — ✅ 29.10
- **Найдена эксплуатируемая дыра:** драйверские server-actions принимали `tripId`/`trip_id`/`driverId` **от клиента** и писали через admin-клиент (`service_role`, RLS обходится). Водитель мог подсунуть чужой `tripId` в сетевом запросе и загрузить документ к чужому рейсу, изменить его статус, удалить чужой расход или создать напоминание для чужого водителя. Проверки `role === 'driver'` в этих файлах **не было вовсе**.
- **Новый модуль `lib/driver-access.ts`:** `getActorContext()` (роль из сессии, нормализована через `normalizeRole`: admin/manager → office) · `driverOwnsTrip(tripId, driverId)` (сверка `trips.driver_id` → `drivers.id`) · `requireTripAccess(tripId)` (офис — все рейсы, водитель — только свой) · `requireExpenseAccess(expenseId)` (расход → его `trip_id` → владение рейсом).
- **Пропатчено:**
  - `app/driver/upload-actions.ts` — `uploadDocument` проверяет владение рейсом; `deleteDocument` проверяет по `trip_id` **ИЗ БД**, а не по аргументу (иначе можно было подсунуть чужой `tripId` и удалить чужой документ).
  - `app/driver/trip-status-actions.ts` — `changeTripStatus` бросает `Error` при отказе (консистентно с остальными ошибками файла, чтобы `TripStatusButtons` показал текст).
  - `app/driver/reminders-actions.ts` — переписан: `driverId` берётся **из сессии**, плюс сверка с аргументом.
  - `app/driver/expense-actions.ts` — `addDriverExpense` проверяет владение рейсом.
  - `app/trip-actions.tsx` — `deleteExpense` и `updateExpense` (общие экшены: зовёт и офис, и водитель) получили `requireExpenseAccess`.
  - `app/driver/telegram-actions.ts` — `sendDriverNotification` теперь **только для офиса** (ранее водитель мог слать произвольные данные в офисный чат).
- **`app/driver/onboarding-actions.ts` проверен — дыры нет:** `driverId` берётся из сессии, роль сверяется.
- **Решения владельца:** Logisat — **для всех машин** (проверку владения машиной не добавляем; `checkLogisat` без изменений) · `/logisat` **в меню офиса не добавляем** (страница остаётся доступной по прямой ссылке, `Sidebar` не тронут).
- **Важно:** это фикс **в коде**, а не в схеме. RLS-политики (фаза 32) закроют тот же класс дыр на уровне БД.

---

### Фаза 32 — RLS-политики + миграции в git (закрыт прямой доступ из интернета) — 29.10
- **Главная находка:** в репозитории не было НИ ОДНОЙ SQL-миграции — все таблицы созданы через Supabase UI, а дефолт в Supabase: **RLS выключен**. Значит anon-ключ (он публичный, лежит в клиентском бандле) читал **любую таблицу целиком** — включая `drivers` (паспорта, визы, права), `users` (email офиса), `trips`, `trip_expenses`. Это дыра шире, чем отсутствие RLS на рейсах.
- **Заведена папка `supabase/migrations/`** — теперь схема и политики воспроизводимы и откатываемы через git, а не живут только в базе.
- **Миграция `20261029_001_rls_trips_segments_expenses.sql`** — функции `public.is_office()` и `public.current_driver_id()` (`security definer`, `set search_path = public`); политики на `profiles`, `trips`, `trip_segments`, `trip_expenses`. SELECT: офис — всё, водитель — только своё. Запись: только офис (запись для водителя запрещена на уровне БД, доступ контролируется в коде — фаза 31). Каждая политика через `drop policy if exists` → миграция идемпотентна.
- **Миграция `20261029_002_rls_remaining_tables.sql`** — RLS на остальных 20 таблицах + функция `public.lookup_login_email(text)`. Строго офис: `clients`, `contractors`, `locations`, `fixed_costs`, `audit_log`, `forwarding_*`. Свой доступ + офис: `drivers`, `users`, `driver_transactions`, `trip_cargo`, `trip_segment_cargo`, `trip_documents`, `documents`, `reminders`. Все авторизованные: `trucks` (по решению владельца Logisat — для всех машин), `rates` (нужен водителю для пересчёта не-евро расходов).
- **`app/login/actions.ts`** — поиск e-mail по логину переведён с прямого `SELECT` из `users`/`drivers` (через anon, ДО авторизации) на `supabase.rpc('lookup_login_email', ...)`. Без этого включение RLS на `users`/`drivers` сломало бы вход.
- **Применение — вручную**, автоматизации в репозитории нет: Supabase SQL Editor → файл `001` → Run → файл `002` → Run. В обоих файлах есть секция `ROLLBACK`.
- **Что это НЕ даёт:** приложение ходит через admin-клиент (`service_role`), который RLS обходит, поэтому поведение приложения не меняется. Закрыт **прямой доступ из интернета** (срочно) и **подготовлена база** для перевода страниц на RLS-клиент (фаза 33).
- **Осторожно:** после применения RLS вход проверять ПЕРВЫМ — и водителя, и офиса. Если логин сломался, откат — секция ROLLBACK.

---

### Фаза 33 — Драйверские страницы переведены на RLS-клиент (RLS заработал) — 29.10
- **Суть:** до этого все страницы ходили через admin-клиент (`service_role`), который RLS обходит. Политики были написаны, но не влияли на выборку приложения. Теперь 6 драйверских страниц читают через anon-клич с сессией пользователя — RLS реально ограничивает выборку.
- **Переведены:** `app/driver/page.tsx` · `app/driver/trips/[id]/page.tsx` · `app/driver/stats/page.tsx` · `app/driver/balance/page.tsx` · `app/driver/logisat/page.tsx` · `app/driver/reminders/page.tsx`. Admin-вызовов в них не осталось, `driverId` везде берётся из `getSessionContext()` (не из куки).
- **Найдена дыра в политиках — сегментное владение.** Приложение считает, что водитель может быть назначен на ОДИН сегмент рейса, а рейс ведёт другой водитель (код: `isTripOwner || isSegmentOwner`). Политики из 001 смотрели только на `trips.driver_id` — такой водитель под RLS потерял бы и рейс, и сегменты. Добавлены функции `driver_owns_trip(uuid)` / `driver_owns_segment(uuid)` и расширены политики на `trips`, `trip_segments`, `trip_expenses`, `trip_cargo`, `trip_segment_cargo`, `trip_documents`.
- **Рекурсия политик.** Политика `trips` ссылается на `trip_segments`, а политика `trip_segments` — на `trips`: прямые ссылки дают `infinite recursion detected in policy`. Проверки вынесены в `security definer` функции — внутри них RLS не применяется, цепочка конечна.
- **Миграция `20261029_003_rls_driver_exceptions.sql`** — сегментное владение + исключения: `clients` (клиенты своих рейсов) и `contractors` (подрядчики своих сегментов). Без них джойны `clients(name)` / `contractors(name)` отдавали бы пустое имя. Применять после 001 и 002, откат — секция `ROLLBACK`.
- **Экшены оставлены на admin-клиенте намеренно:** запись идёт через server actions, а политики на запись разрешают только офису. Водитель меняет статус своего рейса через экшен — при переводе на RLS-клиент запись упала бы. Там работает кодовая проверка из фазы 31.
- **Что это НЕ даёт:** ограничения на уровне БД теперь реальны для этих 6 страниц, но остальные ~88 страниц приложения всё ещё идут через `service_role`.

---

### Фаза 35 — исправление политик RLS: хелперы-владельцы вместо подзапросов — 29.10
- **Проблема найдена CI (фаза 34):** водитель НЕ видел клиента своего рейса. Проверка `driver A: client of own trip` упала: 0 вместо 1. Остальные проверки офиса и водителя А прошли — то есть `current_driver_id()` и RLS на `trips` работали, ломался именно вложенный подзапрос в политике `clients`.
- **Причина:** политика `clients_select_own_or_office` содержала прямой подзапрос к `trips`:
  `exists (select 1 from public.trips t where t.client_id = clients.id and public.driver_owns_trip(t.id))`.
  Подзапрос в политике выполняется от имени ВОДИТЕЛЯ, то есть с действующим RLS таблицы `trips`. RLS `trips` опирается на `driver_owns_trip()`, а тот — на `trip_segments`, чья политика тоже опирается на `trips`. Цепочка `trips → trip_segments → trips` замыкается, и вложенная проверка не даёт нужного результата.
- **Решение — `20261029_004_rls_driver_helper_functions.sql`:** все проверки владения вынесены в `security definer` функции, которые читают `trips`/`trip_segments` напрямую (владелец функции обходит RLS). В политиках остаются только вызовы функций — прямых подзапросов к таблицам больше нет, цепочка не возникает.
  - `driver_owns_trip(id)` — рейс целиком ИЛИ хотя бы один сегмент
  - `driver_owns_segment(id)`
  - `driver_owns_segment_cargo(segment_id)`
  - `driver_has_client(client_id)` — клиент стоит на рейсе водителя
  - `driver_uses_contractor(contractor_id)` — подрядчик на его сегменте/рейсе
  - Пересозданы политики на `trips`, `trip_segments`, `trip_expenses`, `trip_cargo`, `trip_segment_cargo`, `trip_documents`, `clients`, `contractors`.
- **Ничего не потеряно:** сегментный кейс (водитель назначен на один сегмент чужого рейса) сохранён — `driver_owns_trip()` учитывает и сегменты, и рейс целиком.
- **Попутно в 003 добавлен `drop policy` для `clients_office_select` и `contractors_office_select`** — в 002 они созданы как `*_office_select`, а 003 заменяет их на `*_select_own_or_office`. Старая политика оставалась и перекрывала новую.
- **Тесты переписаны (ошибка была и в ожиданиях):** водитель Б в фикстуре ведёт `T-2` целиком И назначен на сегмент `T-1` — значит он видит **2 рейса, 3 сегмента, 2 расхода, 2 груза, 2 клиентов, 3 подрядчиков**. Раньше ожидания были занижены. Добавлены проверки `trip_cargo`, `contractors` и диагностическая функция `dump_ownership()` — при падении сразу видно, что возвращают `current_driver_id()` и `driver_owns_trip()`.
- **Не сделано:** прогон CI после исправления ещё не состоялся — ждём зелёный run.

---

### Фаза 37 — корень падения найден: миграция 004 сносила собственную политику — 29.10
- **Симптом (CI, фаза 36):** `office: trips — ожидалось 2, получено 0`. Офис не видел ни одного рейса.
- **Диагностика вскрыла:** `is_office()` возвращал `false`, и `authenticated` не видел НИ ОДНОГО профиля — даже своего. При этом `auth.uid()` на верхнем уровне возвращал правильный id.
- **Настоящая причина — `drop policy` в ROLLBACK-секции миграции 004.** При вставке блока `grant execute` строка `drop policy if exists trips_select_own_or_office on public.trips;` в секции ROLLBACK осталась РАСКОММЕНТИРОВАННОЙ. Она выполнялась как обычный SQL в конце миграции и сносила политику, которую 004 только что создала.
- **Почему это было так опасно:** у таблицы `trips` оставались insert/update/delete, но **не оставалось НИ ОДНОЙ политики на SELECT**. При включённом RLS такая таблица отдаёт 0 строк ВСЕМ — включая офис. Поведение выглядит как «офис потерял доступ», хотя на самом деле доступа на чтение не было ни у кого.
- **Как найдено:** миграции применены по одной с фиксацией `pg_policies` после каждого шага — `001 YES → 002 YES → 003 YES → 004 NO`. Проверено на PostgreSQL 17 локально.
- **Исправления:**
  - `20261029_004_rls_driver_helper_functions.sql` — весь ROLLBACK закомментирован + добавлена **страховка**: `do $$ ... $$` после всех `drop`/`create` проверяет наличие политик чтения для всех восьми таблиц и **падает с исключением прямо при применении миграции**. Раньше такая ошибка всплывала только в следующем прогоне тестов.
  - `supabase/tests/rls_policies.test.sql` — блок проверки записи переписан: `UPDATE`/`DELETE` под RLS с `using(false)` **не бросают исключение**, а молча затрагивают 0 строк → проверка идёт через `GET DIAGNOSTICS row_count`. Insert остался на ожидании исключения (`with_check` действительно бросает).
  - `supabase/stubs/schema.sql` — `grant` для `service_role` (без него диагностика падала с `permission denied for table trips`).
  - `supabase/tests/diagnostics.sql` — опечатка `p.proponowner` → `p.proowner`.
- **Локальная проверка:** полный пайплайн `prepare → schema → reset → 4 миграции → диагностика → тесты` — **ЗЕЛЁНЫЙ**, 52 проверки. Плюс идемпотентность: повторное применение всех миграций — без ошибок.
- **Что прошло:** офис видит 2 рейса / 2 расхода / 2 груза / 3 подрядчика / 3 профиля / 3 сегмента; водитель А — свой рейс, 2 сегмента, расход, груз, документ, **клиент своего рейса**, 2 подрядчика, транзакция, документ, напоминание; водитель Б — 2 рейса (T-2 целиком + сегмент T-1), 3 сегмента, 2 расхода, 2 груза, 2 клиента, 3 подрядчика, чужие транзакции/документы/напоминания — ноль; `anon` не видит ничего.
- **Важно для боевой базы:** 003 и 004 **не применены**. Проверить в Supabase SQL Editor, что на `trips` есть `trips_select_own_or_office` (001 создавала, 003 пересоздавала).

---

---

## 📈 Состояние скорости (26.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100**.
- **First Load JS shared:** 103 kB.
- **Turbopack** собирает проект за ~7–8 секунд (было ~11 на webpack).

---

## ⏭️ Очередь задач
1. **Проверить Production-деплой PR #48** — после мжера `d45dbdca` убедиться, что деплой вышел в Production, а не только в Preview (автор коммита — `Anatoli`, это сделано).
2. **Перевести остальные страницы на RLS-клиент** — ~88 файлов всё ещё идут через `service_role`, и через них водитель видит больше, чем должен. По приоритету чувствительных данных: водители, документы, расчёты. Проверено в Фазе 38: страницы офиса удобно оставить на admin-клиенте, ограничение нужно там, где доступ различается.
3. **Разбивка гигантских файлов** — актуальный список из issue #13: два docx-роута (`app/api/trips/[id]/segment/[segId]/docx/route.ts` — 29.9 КБ / 1010 строк, `app/api/forwarding/[id]/contractor/[cid]/docx/route.ts` — 27.9 КБ / 993 строки), домен forwarding (5 файлов 20–26 КБ), `app/today/page.tsx` (27.9 КБ), `app/page.tsx` (25.9 КБ), `CargoForm.tsx` (23.3 КБ). Ориентир — до ~500 строк / 15 КБ. Файлов крупнее 20 КБ всего 13.
4. **Правила доступа для новых ролей** — когда понадобится: логист, бухгалтерия, клиент. Матрица готова, менять только `ROLE_CAPABILITIES`.
5. **Базовая миграция с полной схемой** — чтобы `supabase/stubs/schema.sql` можно было удалить, а `supabase db push` работал по-настоящему.

---

### Фаза 38 — lib/session.ts и lib/driver-access.ts на RLS-клиенте — 29.10
- **Суть:** узкое горлышко доступа. 48 мест зовут `getSessionContext()`, а роль актора и владение рейсом читались через admin-клиент (`service_role`), который RLS обходит. Права держались только в коде — база о них не знала.
- **`lib/session.ts` (переписан):** профиль читается через RLS-клиент (anon-ключ + сессия). Политика `profiles_select_own_or_office` разрешает строку с `id = auth.uid()`. **Откат на admin при сбое** (политика не применена, миграция не залита, сессия сломана) — строго одна строка по `id = user.id`, расширения прав не даёт, но подрядчик не вылетает в `/login`.
- **`lib/driver-access.ts` (переписан):** водитель читает `trips` и `trip_expenses` через RLS-клиент → **владение решает сама БД**. Офис остался на admin-клиенте: офис читает всё, RLS для него ничего не даёт, перевод добавил бы риск без выигрыша.
- **`lib/access-rules.ts` (новый):** чистые правила `actorOwnsTrip` / `evaluateTripAccess` / `evaluateExpenseAccess` без Supabase и без `server-only` — только их можно покрыть юнит-тестами.
- **Исправлено расхождение кода и БД.** Старая `driverOwnsTrip()` смотрела только на `trips.driver_id === driverId` и не знала про сегментный случай, хотя политика `public.driver_owns_trip()` считает владением и рейс целиком, и назначение хотя бы на один сегмент. Водитель, назначенный на один сегмент чужого рейса, по БД владеет рейсом, а по коду получал отказ «Рейс не принадлежит вам».
- **Сигнатуры не менялись** (`getSessionContext` / `getActorContext` / `requireTripAccess` / `requireExpenseAccess`) — 48 потребителей правок не требуют.
- **Тесты:** `lib/__tests__/access-rules.test.ts` — 14 тестов на матрицу ролей, владение рейсом и расходом, тексты причин отказа. Всего 42.
- **PR #40** (`feature/phase-38-rls-session` → `master`), коммит `694e0ae`. Автор коммита — `Anatoli <78858463+kru4ara@users.noreply.github.com>`, иначе Vercel не свяжет коммит с проектом и Production-деплой не выкатится.

---

### Фаза 39 — Режим расчёта выводится из исполнителей — 01.11
- **Проблема:** режим расчёта (`trips.profit_mode`) выбирался радиокнопками в форме создания заказа. Но в момент получения заявки от клиента мы **ещё не знаем, кто повезёт груз**. Выбор давал два неправильных ответа: угадал — заказ без номера, но с чужим режимом; не угадал — исправить нельзя, в форме редактирования `profit_mode` нет вовсе.
- **Решение (01.11.2026):** режим **не выбирается** — он **вычисляется** из фактических исполнителей заказа.
  | Сегменты заказа | Режим |
  |---|---|
  | `executor_type='us'` с машиной **и** водителем | `trip` |
  | только `executor_type='contractor'` | `forwarding` |
  | смешанный (наш транспорт + подрядчик) | `trip` |
  | нет ни одного сегмента | не определён → заказ без номера |
- **Смешанный заказ остаётся рейсом:** расходы подрядчика идут в прямые расходы рейса — как и было. Третья математика не вводится, годовая статистика и отчёты не меняются.
- **Код:**
  - `lib/orders-core.ts` — `deriveProfitMode(segments)`: **единственное** место вывода режима (продублировано в БД как `public.derive_profit_mode(uuid)`). `hasAssignedExecutor()` переведён с полей заказа на сегменты. Тип `renumberOrders` расширен на `segments`.
  - `app/trips/new/NewTripForm.tsx` — блок «Режим расчёта» удалён целиком: radio `profit_mode`, `useState mode`, поля `load_date`/`unload_date`. Остались галочки «Экспедирование (происхождение)» и «Расходы сведены» — они только помечают происхождение, на математику не влияют.
  - `app/geocode-actions.ts` — режим больше не читается из формы; `profitMode` удалён полностью. `load_date`/`unload_date` при создании = `null` (проставит триггер), `profit_mode` = `'trip'` по умолчанию — колонка `NOT NULL`.
- **БД — миграция `20261101_007_profit_mode_from_segments.sql`:** новая функция `public.derive_profit_mode(uuid)` (возвращает `'trip'` / `'forwarding'` / `NULL`) + переписанный `sync_trip_from_segment`:
  1. режим **вычисляется** из всех сегментов заказа;
  2. записывается в заказ;
  3. только потом применяются правила дат (у экспедиции — из сегмента подрядчика, у рейса — из сегмента с нашей машиной).
  Раньше триггер **читал** `profit_mode` и по нему решал, что синхронизировать — то есть зависел от режима, который сам же должен был выводиться. Цикл развёрнут.
  Пересчёт режима у существующих заказов — **с бэкапом** в `public.bak_trips_profit_mode_20261101` (бэкап пуст: пересчёт не изменил ни одного заказа).
- **Проверка:** сверка режима с фактическими исполнителями по всем 108 заказам — расхождений 0; после применения миграции `changed = 0`.
- **⚠️ Миграции в этом проекте применяются вручную** — Supabase SQL Editor → вставить → Run. DDL через RPC недоступен. `007` уже применена 01.11.2026.
- **PR #48** (`feature/profit-mode-from-segments` → `master`), коммиты `2f389f8` + `811d692` (фикс JSX), merge `d45dbdca`. Автор — `Anatoli <78858463+kru4ara@users.noreply.github.com>`, иначе Production-деплой не выкатится.
- **Урок:** блок JSX вырезать по **границам тегов**, а не по номерам строк. Первая версия оставила лишний `</div>` → сборка падала: `Expected '</', got 'jsx text'`. Проверка перед коммитом: баланс `<div>`/`</div>`, `{}`, `()` — все ноль.

---

## 📊 Состояние данных (01.11.2026)
- `trips`: 108 (из них 31 — экспедирование, `profit_mode='forwarding'`; без номера — 0).
- `trip_segments`: 134, `trip_cargo`: 114, `trip_expenses`: 523.
- `profiles`: 3 записи (1 admin, 2 driver).
- Режим расчёта у всех заказов **совпадает** с фактическими исполнителями (расхождений 0).

---

## 📋 Шпаргалка
- **Supabase-клиенты:** `lib/supabase/admin.ts` (service_role, обходит RLS, `server-only` ✅) · `lib/supabase/server.ts` (anon+куки, `server-only` ✅) · `proxy.ts` (свой `createServerClient`, намеренно — `request.cookies` vs `cookies()`).
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Линт:** `npm run lint` (ESLint 9 + `eslint-config-next`, 0 warnings / 0 errors).
- **Тесты:** `npm run test` (Vitest, **~95 тестов** в 8 файлах `lib/__tests__/`).
- **CI:** GitHub Actions (Actions → CI) — lint → `tsc --noEmit` → test → build. Работает, покрывает всё.
- **Права:** `can(role, 'cap')` из `lib/roles.ts`; путь → право через `capabilityForRequest(pathname, method)`.
- **Доступ к рейсу/расходу:** `requireTripAccess` / `requireExpenseAccess` из `lib/driver-access.ts`; чистые правила — в `lib/access-rules.ts`; владение решает БД (политика `driver_owns_trip`), в коде его не дублировать.
- **`next.config.js`:** без `eslint`, только `experimental` (serverActions, optimizePackageImports).
- **`eslint.config.mjs`:** `@eslint/js` + `typescript-eslint` + `react` + `react-hooks` + `globals`.
- **`postcss.config.js`:** только `@tailwindcss/postcss`.
- **Режим расчёта:** не выбирается — `deriveProfitMode()` в `lib/orders-core.ts` / `public.derive_profit_mode(uuid)` в БД. Правило: наш транспорт (машина+водитель) → рейс, только подрядчик → экспедирование, смешанный → рейс, нет сегментов → без номера.
- **Миграции:** `supabase/migrations/`, применяются **вручную** в Supabase SQL Editor. Последняя — `20261101_007_profit_mode_from_segments.sql` (применена 01.11.2026).
- **DDL из приложения недоступен:** RPC `exec_sql_json` даёт `select`, но не `create/alter`.
- **`exceljs`:** в `dependencies`, ленивый импорт в клиентах, статический — в API.
- **`npm audit`:** 5 moderate (`postcss-selector-parser` через Tailwind) — принятый dev-риск.
- **Аккаунты:** админ — `raibuilding@gmail.com`, водители — `vasiliuk@...`, `kavaliou@...`.
- **PWA:** установка через «Добавить на главный экран».

**Закрыто:** Фазы 3.1–3.39.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас.
3. Сам файл, целиком.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
