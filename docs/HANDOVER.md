# HANDOVER — Logistics CRM (29.10.2026)

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
- **Линт** — отдельный файл `eslint.config.mjs` на чистых плагинах (`@eslint/js`, `typescript-eslint`, `react`, `react-hooks`, `globals`). **`eslint-config-next` больше не используется.**

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
- Удалён `eslint-config-next` (ломается в CI на Next 16).
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

---

## 📈 Состояние скорости (26.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100**.
- **First Load JS shared:** 103 kB.
- **Turbopack** собирает проект за ~7–8 секунд (было ~11 на webpack).

---

## ⏭️ Очередь задач
1. **Миграция на RLS** — политики под роли, чтобы совпадали с матрицей `ROLE_CAPABILITIES`. Сейчас 90 файлов ходят через `service_role` и **обходят RLS**; права держит только код. Порядок: `trips` → `trip_segments` (самые чувствительные: рейсы и доходы водителей) → `drivers` → `profiles`. Начинать с кандидатов фазы 30: `app/driver/page.tsx`, `app/driver/trips/[id]/page.tsx`.
2. **Проверить руками роли** после фазы 29: водитель по прямым ссылкам на `/trips`, `/trips/new`, `/trips/[id]/edit`, `/routes/export`, `/search` → редирект; админ → всё как раньше. Отдельно водительский `/driver/logisat` — теперь должен открываться (было сломано правилом `logisat.sync` на GET, исправлено в фазе 29).
3. **`revalidateTag`** — если где-то используется, добавить второй аргумент (профиль кэша) при необходимости.
4. **Разбивка гигантских файлов** — `statistics/page.tsx` (48 КБ), `SegmentForm.tsx` (47 КБ), `drivers/[id]/page.tsx` (1000+ строк) → компоненты + серверные функции.
5. **Правила доступа для новых ролей** — когда понадобится: логист, бухгалтерия, клиент. Матрица готова, менять только `ROLE_CAPABILITIES`.
6. **Очистка warnings** — оставшиеся неиспользуемые импорты/переменные. Не критично. **Внимание:** чистить только точечным переписыванием импорта, не удалением строки.

---

## 📊 Состояние данных (29.10.2026)
- `trips`: ~75, `trip_segments`: ~98, `trip_cargo`: ~78, `trip_expenses`: ~455.
- `profiles`: 3 записи (1 admin, 2 driver).

---

## 📋 Шпаргалка
- **Supabase-клиенты:** `lib/supabase/admin.ts` (service_role, обходит RLS, `server-only` ✅) · `lib/supabase/server.ts` (anon+куки, `server-only` ✅) · `proxy.ts` (свой `createServerClient`, намеренно — `request.cookies` vs `cookies()`).
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Линт:** `npm run lint` (ESLint 9 + чистые плагины, без `eslint-config-next`).
- **Тесты:** `npm run test` (Vitest, **28 тестов**).
- **CI:** GitHub Actions (Actions → CI) — lint → `tsc --noEmit` → test → build. Работает, покрывает всё.
- **Права:** `can(role, 'cap')` из `lib/roles.ts`; путь → право через `capabilityForRequest(pathname, method)`.
- **`next.config.js`:** без `eslint`, только `experimental` (serverActions, optimizePackageImports).
- **`eslint.config.mjs`:** `@eslint/js` + `typescript-eslint` + `react` + `react-hooks` + `globals`.
- **`postcss.config.js`:** только `@tailwindcss/postcss`.
- **`exceljs`:** в `dependencies`, ленивый импорт в клиентах, статический — в API.
- **`npm audit`:** 5 moderate (`postcss-selector-parser` через Tailwind) — принятый dev-риск.
- **Аккаунты:** админ — `raibuilding@gmail.com`, водители — `vasiliuk@...`, `kavaliou@...`.
- **PWA:** установка через «Добавить на главный экран».

**Закрыто:** Фазы 3.1–3.30.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас.
3. Сам файл, целиком.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
