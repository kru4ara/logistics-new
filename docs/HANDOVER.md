# HANDOVER — Logistics CRM (25.10.2026)

## Стек и инфраструктура
- Next.js 15.5.28 (App Router) + React 19.3.1 + Supabase + Vercel
- GitHub: `kru4ara/logistics-new` (master) — автокоммит на каждое изменение
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: `logistics-core`, org `Raibuilding`
  - ⚠️ **ПРАВИЛЬНЫЙ REF:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i` после `smodijsj`)
  - ❌ **ОШИБОЧНЫЙ (частая опечатка):** `smodijsjwvsscfgloh` (без `i`) → NXDOMAIN
  - **Правило:** копировать ТОЛЬКО кнопкой Copy из Settings → General.
- Vercel project: `kru4aras-projects/logistics-new`

### ENV (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — клиент, RLS закрыт
- `SUPABASE_SERVICE_ROLE_KEY` — server client, обходит RLS
- `LOGISAT_SERVER` / `LOGISAT_USERNAME` / `LOGISAT_PASSWORD`
- `TELEGRAM_BOT_TOKEN` — @raibuilding_bot
- `TELEGRAM_CHAT_ID` — `921520481` (личка владельца; общего чата офиса нет)
- `TELEGRAM_WEBHOOK_SECRET`
- `CRON_SECRET`

**Vercel Secret-переменные не редактируются** — только удалить + создать заново + Redeploy.

---

## 🚨 Vercel Hobby Лимит и GitHub Outage
Если Vercel не запускает билды после `git push`:
1. Это лимит Hobby (100 деплоев/сутки) или сбой GitHub-Vercel интеграции.
2. **Решения:**
   - Ждать 24 часа.
   - `git commit --allow-empty -m "trigger"` + `git push`.
   - Сделать Redeploy вручную через GitHub (иконка Vercel у коммита) или в панели Vercel.
   - `npx vercel --prod` из терминала.
3. Если Vercel пишет «This commit has already been built» — не жмите кнопку деплоя, он уже на проде.

---

## ⚠️ Правила работы с AI-ассистентом

### Контекст чата — не бесконечный
Окно ~200k токенов. Загрузка крупных файлов, бэкапов, полных HANDOVER'ов и логов быстро съедает запас. Когда переполняется — ассистент теряет начало чата (HANDOVER, договорённости).

### Что НЕ грузить в чат
- Бэкапы БД (`backup_*.json`) — 200–300 KB мёртвого груза
- Старые версии HANDOVER
- Уже заменённые файлы
- Логи билдов целиком
- Огромные JSON/дампы
- **Секреты**

### Что грузить
- Только файлы, которые сейчас правим (по одному)
- Актуальный HANDOVER — один раз в начале
- Результат grep (список, не содержимое)
- Короткий скриншот ошибки

### Рабочий процесс (Next.js 15)
- Полные файлы на замену, не куски
- 1 шаг за раз
- НЕ пишем вслепую — просим актуальную версию
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Server components → `createClient()` из `lib/supabase-server`
- **ВСЕГДА** `await cookies()` и `await searchParams` (Next 15 async API).
- **Один коммит = связанные файлы** (иначе Vercel падает на type-check)
- **`import` должны быть в начале файла**, до `export const dynamic` и любого кода

### ⚠️ Git (локально)
- `git pull --no-edit` (избегаем Vim).
- При `rejected` — `git pull --no-edit`, потом `git push`.
- Если конфликт в `package.json` — **всегда оставлять нашу версию** (с алиасами и обновлениями).
- Если редактор не сохраняет или остались маркеры `<<<<<<<` — `cat > file << 'EOF' ... EOF` в Git Bash.
- **Git Bash склеивает команды при вставке** — выполнять строго по одной строке, без вложенных кавычек. Если начал склеивать — закрыть окно, открыть новое.
- **`sed` на JSX — запрещён.** Ломает парные теги (`<a>...</Link>`). Замены только вручную через GitHub-редактор или полными файлами.

---

## 🎨 Дизайн-система
- Палитра: `brand` (индиго), `accent` (фиолет), `ink` (тёмный).
- Утилиты: `.card`, `.btn`, `.input`, `.badge`, `.skeleton`.
- Иконки: `lucide-react` (через `optimizePackageImports`).

---

## 📁 Структура проекта

### Гибкая модель рейсов (грузы + сегменты)
**`trip_cargo`**: `id`, `trip_id`, `position`, `label`, `cargo_type`, `weight_kg`, `pallets`, `client_id`, `notes`, `from_*`, `to_*`, `customs_place`, `customs_country`, `customs_city`, `customs_postal_code`, `customs_address`, `customs_lat`, `customs_lng`, `freight_amount`, `freight_currency`, `created_at`

**`trip_segments`**: `id`, `trip_id`, `position`, `executor_type`, `contractor_id`, `truck_id`, `trailer_id`, `driver_id`, `date_from`, `date_to`, `from_*`, `to_*`, `stops` JSONB, `price`, `currency`, `notes`, `contractor_*`, `created_at`

**`trip_segment_cargo`**: `segment_id`, `cargo_id`
**`trip_expenses`**: `segment_id` (FK).
**`driver_transactions`**: начисления и выплаты.
**`counters`**: для нумерации рейсов.
**`profiles`** (НОВОЕ): `id` (FK к `auth.users`), `role` ('admin' | 'driver'), `driver_id` (FK к `drivers`), `full_name`, `created_at`. Связывает Supabase Auth с бизнес-логикой.

### Удалённые таблицы/колонки
- `trip_subcontractors` — DROP.
- `trips`: `sender_*`, `receiver_*`, `route` (37 колонок) — DROP.
- `drivers.phone` → `phone_by`, `phone_pl`.
- `trip_expenses.subcontractor_id` — DROP (22.10).
- `forwarding_orders.route_from`, `route_to` — DROP (22.10).

### Триггеры и функции
- `counters` + `next_trip_number()` — монотонная нумерация.
- `assign_trip_number_on_segment()` — присваивает номер.
- `renumber_all_trips()` — пересчёт при удалении.
- `sync_trip_from_segment()` — синхронизирует машину/водителя/прицеп.
- `merge_clients()`, `merge_contractors()` — объединение.
- `handle_new_user()` — автосоздание профиля при регистрации в Supabase Auth.

### Хелперы (`lib/`)
- `trip-route.ts` — `buildRouteMap(segments)`
- `geocode.ts` — `geocode(city, country, postalCode?)`
- `trip-task-text.ts` — `buildDriverTaskText(...)`
- `translate-pl.ts` — `translateToPl(text)`
- `company.ts` — `COMPANY`, `getTerms(...)`
- `audit.ts` — `logAudit`, `diffFields`
- `cron-alert.ts`, `telegram.ts`
- `supabase-server.ts` — admin client (service_role, **только сервер**, защищён `import 'server-only'`)
- `supabase/server.ts` — ssr клиент с сессией
- `supabase/client.ts` — браузерный клиент
- `trip-renumber.ts` — `renumberAllTrips(...)`

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
- `next` → `14.2.35` (затем 15).
- `xlsx` → `0.20.3` (CDN).
- `image-size` → `safe-image-size@1.2.1` (алиас).
- Ленивые импорты (`xlsx`, `TripsBulkList`, `MapView`).
- `/trips`: 204→113 kB, `/reports`: 190→97 kB, `/map`: 146→105 kB.

### Фаза 11 — Миграция на Next.js 15 + React 19 — ✅ 21.10 (вечер)
- **Next.js:** `14.2.35` → **`15.5.28`**.
- **React:** `18.3.1` → **`19.3.1`**.
- **react-leaflet:** `4.2.1` → **`5.0.0`**.
- **react-leaflet-cluster:** `2.1.0` → **`4.1.3`**.
- **Кодмод:** `npx @next/codemod@canary next-async-request-api .` (40 файлов).
- **Ручные фиксы:** `await cookies()`, `searchParams: Promise`, `next/dynamic` (через `MapViewWrapper` и `TripsBulkListWrapper`), `AppShell` async, `layout` async.
- **Результат:** билд зелёный на Vercel. Прод работает заметно быстрее.

### Фаза 12 — Рефакторинг карточки рейса и UI — ✅ 22.10 (ночь)
- **Редактирование расходов:** `ExpensesList.tsx` (клиентский), `EditExpenseDialog.tsx`, `updateExpense` в `trip-actions.tsx`, `deleteExpenseAction` в `expense-actions.ts`. Добавлены иконки редактирования и удаления.
- **Верстка расходов:** убрана колонка «Источник», информация об участке вынесена под категорию. Добавлены `whitespace-nowrap` и `truncate` для аккуратности.
- **Карточка рейса (`page.tsx`):** кнопки статуса и телеметрия перенесены наверх (в шапку), старые блоки внизу удалены. Кнопки «Редактировать / Logisat / Удалить» теперь в шапке.
- **Форма редактирования рейса:** удалены пустые блоки «Отправитель/Получатель» (`EditTripForm.tsx`), так как данные берутся из грузов и участков.
- **Задание водителю (`lib/trip-task-text.ts`):** убраны дубли из шапки (Маршрут, Тягач), маршрут выводится в блоке «ТВОЙ МАРШРУТ».
- **Форма создания заявки (`NewTripForm.tsx`):** блоки «Таможня» и «Куда» поменяны местами (логика: Откуда → Таможня → Куда).
- **Форма сегмента (`SegmentForm.tsx`):** исправлен пропадающий прицеп (добавлен `useEffect` для синхронизации `initialData`), а также добавлены проверки и поля для типа транспорта подрядчика.

### Фаза 13 — Аудит зависимостей и миграция линтера — ✅ 22.10 (день)
- **`npm audit fix`:** закрыл `brace-expansion`, `source-map-js`.
- **`postcss`:** `overrides` + синхронизация `devDependencies` на `^8.5.23` → резолвится `8.5.31` везде `deduped` (включая `next`).
- **`glob`:** `overrides: "10.5.0"`.
- **`braces`:** ушёл после обновления зависимостей.
- **`postcss-selector-parser` (3 moderate):** dev-only, принят как риск (Tailwind 3 не может использовать 7.x).
- **Миграция линтера:** `next lint` → ESLint CLI + ESLint 9 + flat config. `eslint.config.mjs` через `FlatCompat`.
- **`next.config.js`:** добавлен `eslint: { ignoreDuringBuilds: true }`.
- **`eslint-config-next@15.5.28`:** обновлён.

### Фаза 14 — Ремонт линта (54 ошибки → 0) — ✅ 23.10
- **`<a>` → `<Link>` (35):** все страницы + `Sidebar`.
- **`react/no-unescaped-entities` (2):** `reports/contractors/page.tsx:420`.
- **`react-hooks/static-components` (4):** `SidebarContent`, `EmptyBlock`, `EventCard` вынесены на уровень модуля.
- **`react-hooks/purity` (2):** `Date.now()` в серверных компонентах — точечный `eslint-disable`.
- **`react-hooks/immutability` (1):** `DashboardCharts.tsx` → `reduce`.
- **`react-hooks/set-state-in-effect` (6):** рефакторинг + точечные `eslint-disable` для канонических паттернов (URL sync, форма с `initialData`).
- **`@next/next/no-img-element` (1 warning):** `CountryFlag.tsx` — точечный disable.
- **`drivers/page.tsx`:** `<img>` → `<Image unoptimized>`.

### Фаза 15 — Миграция на `exceljs` — ✅ 24.10
- `npm install exceljs` + `npm uninstall xlsx`.
- `exceljs` в `dependencies`.
- Переписаны: `app/api/export/route.ts`, `app/reports/DownloadButton.tsx`, `app/routes/DownloadButton.tsx`, `app/trips/DownloadButton.tsx`.
- В клиентских файлах — динамический `import('exceljs')`.
- В API — статический.

### Фаза 16 — Проверка производительности и безопасности — ✅ 24.10
- `SERVICE_ROLE_KEY` только в `lib/supabase-server.ts`.
- RLS включён на всех таблицах.
- `First Load JS shared`: 103 kB. `exceljs`, `leaflet`, `docx` — ленивые.
- `@next/bundle-analyzer` удалён.

### Фаза 17 — Миграция на Supabase Auth — ✅ 24.10
- Установлен `@supabase/ssr`.
- Созданы: `lib/supabase/server.ts`, `lib/supabase-browser.ts`, `middleware.ts`.
- Переписан `app/login/actions.ts` (вход через `signInWithPassword`).
- SQL: таблица `profiles`, RLS, триггер `handle_new_user`.
- В `profiles` оставлены: 1 админ (`raibuilding.pl@gmail.com`) и 2 водителя (`VASILIUK`, `KAVALIOU`).
- Пароли водителей обновлены через bcrypt (старые восстановлены).
- Куки `role`, `driver_id` устанавливаются для совместимости со старым UI.

### Фаза 18 — Улучшения UX/UI и PWA — ✅ 25.10
- **PWA:** `manifest.webmanifest`, `sw.js`, `ServiceWorkerRegister` в `layout.tsx`. Водители могут установить на телефон.
- **Массовые статусы:** чекбоксы в `TripsBulkList`, Server Actions `bulkSetStatus` и `bulkDelete`. Защита от массового `completed`.
- **WhatsApp-кнопка:** в `CopyBlock` добавлена кнопка, открывающая чат с водителем (использует `phone_by`).
- **Отчёт «Фрахт по грузам»:** страница `/reports/cargo`. Распределяет расходы рейса пропорционально фрахту груза. Если у груза нет фрахта, берёт сумму рейса (с пометкой `*`). Сортировка по дате.

### Фаза 19 — Инфраструктура и тесты — ✅ 25.10
- **CI:** `.github/workflows/ci.yml` (lint + tsc + test + build).
- **Vitest:** настроен (`vitest.config.js`), тесты на `buildRouteMap` (6) и `renumberAllTrips` (4).
- **`server-only`:** добавлен в `lib/supabase-server.ts`.
- **`.env.example`:** создан.
- **Типы:** `@types/react` обновлён до 19.x.

---

## 📈 Состояние скорости (25.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100**.
- **First Load JS shared:** 103 kB.
- **`/map`:** 105 kB.
- **`/trips`:** 118 kB.
- **`/reports`:** 114 kB.

---

## ⏭️ Очередь задач
1. **Роли в Middleware:** сейчас проверяется только «залогинен/нет». Нужно закрыть `/reports`, `/audit` для водителей (редирект на `/driver`).
2. **Размер файлов:** `statistics/page.tsx` (48 КБ), `SegmentForm.tsx` (47 КБ) — вынести логику в `data/` и компоненты.
3. **Тесты:** покрыть `trip-task-text.ts` и логику прибыльности.
4. **`@types/react`** обновлён, но `eslint-plugin-react` устарел для React 19 (можно заменить на `@eslint-react/eslint-plugin`).
5. **Tailwind 4 / Next 16** (breaking).

---

## 📊 Состояние данных (25.10.2026)
- `trips`: ~75, `trip_segments`: ~98, `trip_cargo`: ~78, `trip_expenses`: ~455.
- `profiles`: 3 записи (1 admin, 2 driver).
- `audit_log`: ~471+.
- **Бэкапы:** `backup_2026-10-21_0731.json` — доставлен в Telegram ✅. Cron работает.

---

## 📋 Шпаргалка
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Линт:** `npm run lint` (0 errors, 0 warnings).
- **Тесты:** `npm run test` (Vitest, 10 тестов).
- **CI:** GitHub Actions (Actions → CI).
- **`package.json` overrides:** `postcss: "^8.5.23"`, `glob: "10.5.0"`.
- **`eslint.config.mjs`:** `FlatCompat` + `compat.extends('next/core-web-vitals')`. `.next` в ignores.
- **`exceljs`:** в `dependencies`, ленивый импорт в клиентах, статический — в API.
- **`npm audit`:** 3 moderate (`postcss-selector-parser` через Tailwind 3) — принятый dev-риск.
- **Аккаунты:** админ — `raibuilding.pl@gmail.com`, водители — `vasiliuk@...`, `kavaliou@...`. Пароли в Supabase Auth.
- **PWA:** установка через «Добавить на главный экран» (Chrome/Safari).

**Закрыто:** Фазы 3.1–3.19.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас.
3. Сам файл, целиком.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
