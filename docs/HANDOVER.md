# HANDOVER — Logistics CRM (24.10.2026)

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
- Если конфликт в `package.json` — **всегда оставлять нашу версию**.
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

### Хелперы (`lib/`)
- `trip-route.ts` — `buildRouteMap(segments)`
- `geocode.ts` — `geocode(city, country, postalCode?)`
- `trip-task-text.ts` — `buildDriverTaskText(...)`
- `translate-pl.ts` — `translateToPl(text)`
- `company.ts` — `COMPANY`, `getTerms(...)`
- `audit.ts` — `logAudit`, `diffFields`
- `cron-alert.ts`, `telegram.ts`

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
### Фаза 12 — Рефакторинг карточки рейса и UI — ✅ 22.10 (ночь)
### Фаза 13 — Аудит зависимостей — ✅ 22.10 (день)
- `postcss`: `overrides` + синхронизация `devDependencies` на `^8.5.23` → `8.5.31` везде `deduped`.
- `glob`: `overrides: "10.5.0"`.
- `brace-expansion`, `source-map-js`: `npm audit fix`.
- `braces`: ушёл после обновления зависимостей.
- `postcss-selector-parser` (3 moderate): dev-only, принят как риск (Tailwind 3 не может использовать 7.x, фикс только в Tailwind 4).
- **`eslint-config-next@15.5.28`:** обновлён (в 15.x нет нативного flat-экспорта, `FlatCompat` оставлен).
- **`exceljs` вместо `xlsx`:** миграция завершена (4 файла).

### Фаза 14 — Ремонт линта (54 ошибки → 0) — ✅ 23.10
**Миграция линтера:**
- `next lint` → ESLint CLI + ESLint 9 + flat config.
- `eslint.config.mjs` через `FlatCompat`.
- `next.config.js`: `eslint: { ignoreDuringBuilds: true }`.

**Закрыто:**
- **`<a>` → `<Link>` (35):** все страницы + `Sidebar`. `tel:` / `mailto:` / `https://` / `target="_blank"` — оставлены `<a>`.
- **`react/no-unescaped-entities` (2):** `reports/contractors/page.tsx:420` → `&apos;`.
- **`react-hooks/static-components` (4):** `SidebarContent` (Sidebar), `EmptyBlock` + `EventCard` (today) вынесены на уровень модуля.
- **`react-hooks/purity` (2):** `Date.now()` в `logisat/page.tsx:90` и `today/page.tsx:317` → точечный `eslint-disable` (серверные компоненты).
- **`react-hooks/immutability` (1):** `DashboardCharts.tsx:302` → `reduce` с предвычислением `slices`.
- **`react-hooks/set-state-in-effect` (6):**
  - `AppShellClient` — ленивая инициализация `useState(readPinnedFromStorage)`.
  - `DuplicateChecker` — сброс в `onChange`, `setLoading(true)` — disable.
  - `Toaster` — `setVisible` — disable (URL sync).
  - `OverlapWarning` — сброс в `setTimeout`, `return null` при отсутствии входных данных.
  - `SearchInput` — `setValue(initialQ)` — disable (URL sync).
  - `SegmentForm` — `/* eslint-disable */ ... /* eslint-enable */` вокруг `useEffect` синхронизации с `initialData`. TODO: `key={segmentId}` в родителе.
- **`@next/next/no-img-element` (1 warning):** `CountryFlag.tsx` — точечный disable (флаг с `flagcdn.com`).
- **`drivers/page.tsx`:** `<img>` → `<Image unoptimized>` для фото паспорта.

**Итог:** `npm run lint` → `0 errors, 0 warnings`.

### Фаза 15 — Миграция на `exceljs` — ✅ 24.10
- `npm install exceljs` + `npm uninstall xlsx`.
- `exceljs` в `dependencies` (не `devDependencies`!).
- Переписаны 4 файла:
  - `app/api/export/route.ts` — `ExcelJS.Workbook`, `addWorksheet`, `columns`, `addRows`, `writeBuffer` для XLSX и `csv.writeBuffer` для CSV.
  - `app/reports/DownloadButton.tsx` — динамический `import('exceljs')`, `writeBuffer` → `Blob` → `a.download`.
  - `app/routes/DownloadButton.tsx` — то же.
  - `app/trips/DownloadButton.tsx` — то же.
- В клиентских файлах `exceljs` загружается **лениво** (динамический импорт).
- `api/export` использует **статический** импорт (серверный роут).

## ✅ Фаза 16 — Проверка производительности и безопасности — ЗАКРЫТО (24.10.2026)

**Безопасность:**
- `SUPABASE_SERVICE_ROLE_KEY` используется **только** в `lib/supabase-server.ts` (серверный хелпер).
- `process.env` в клиентских компонентах — нет (только `NEXT_PUBLIC_*`).
- Файлов с `'use client'`, импортирующих `supabase-server`, нет.
- RLS включён (`rowsecurity = true`) на `trip_cargo`, `trip_segments`, `trip_segment_cargo`, `trip_expenses`, `driver_transactions`.

**Бандл (после всех миграций):**
- `First Load JS shared by all`: **103 kB** (не вырос после `exceljs`).
- `exceljs`, `leaflet`, `docx` — ленивые, в shared не входят.
- Самые тяжёлые страницы: `/trips/[id]` 133 kB (20.8 kB своего), `/trips` 121 kB, `/reports` 117 kB. Все — в пределах нормы для насыщенных интерактивных страниц.
- `@next/bundle-analyzer` удалён после проверки.

**Правила на будущее:**
- `@next/bundle-analyzer` (и любые dev-инструменты) **не оборачивать `next.config.js` безусловно** — только через `if (process.env.ANALYZE === 'true')`, иначе Vercel падает (devDependencies не ставятся в проде).
- Тяжёлые библиотеки (`exceljs`, `docx`, `leaflet`) — только через динамический `import()` или серверные API-роуты.

## ✅ Фаза 17 — Миграция на Supabase Auth — ЗАКРЫТО (24.10.2026)

**Что сделано:**
- Установлен `@supabase/ssr`.
- Созданы:
  - `lib/supabase/server.ts` — серверный клиент с сессией (использует `NEXT_PUBLIC_SUPABASE_ANON_KEY`, подчиняется RLS).
  - `lib/supabase-browser.ts` — браузерный клиент.
  - `middleware.ts` — проверяет `supabase.auth.getUser()` на каждом запросе, редиректит неавторизованных на `/login`.
- Переписан `app/login/actions.ts`:
  - Вход через `supabase.auth.signInWithPassword()`.
  - Поиск email по логину в таблицах `users` (офис) и `drivers` (водители).
  - Установка куки `role`, `driver_id`, `user_name` **для совместимости со старым UI**.
  - Редирект на `/` (админ) или `/driver` (водитель).
- В Supabase SQL:
  - Создана таблица `profiles` (связь `auth.users` с ролью и `driver_id`).
  - Включён RLS на `profiles`.
  - Создан триггер `handle_new_user` (автосоздание профиля при регистрации).
  - Добавлены `email` в `drivers` (для связи).
- В `profiles` оставлены только: **1 админ** (`raibuilding.pl@gmail.com`) и **2 водителя** (`VASILIUK`, `KAVALIOU`).
- Пароли водителей обновлены через `auth.users.encrypted_password` (bcrypt), старые пароли сохранены.

**Что осталось (технический долг, не срочно):**
- Постепенно заменить чтение `cookies().get('role')` в страницах и `AppShellClient` на `supabase.auth.getUser()` + запрос к `profiles`. Тогда куки можно будет убрать.
- Настроить SMTP для сброса паролей через email (сейчас сброс только вручную).

---

## 📈 Состояние скорости (24.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100** (до миграции).
- **После Next.js 15:** заметно быстрее.
- **First Load JS shared:** 103 kB.
- **`/map`:** 105 kB (было 146 kB).
- **`/trips`:** 118 kB (было 204 kB).
- **`/reports`:** 114 kB (было 190 kB).

---

## ⏭️ Очередь задач
1. **Отчёт «фрахт по грузам»** — единственный оставшийся пункт из старой очереди. Нужно уточнить: какие колонки, группировка, фильтры.
2. **Проверка безопасности:** `SERVICE_ROLE_KEY` не в клиентских компонентах, RLS на новых таблицах (`trip_cargo`, `trip_segments`, `trip_expenses`).
3. **`optimizePackageImports`:** добавить `react-leaflet`, если нужно.
4. **Миграция на `eslint-config-next@16` + Next 16** (отдельная фаза, breaking): уберёт `FlatCompat`, `next lint` полностью удалён, flat config нативный.
5. **Tailwind 4** (breaking): закроет `braces` и `postcss-selector-parser` в аудите.

---

## 📊 Состояние данных (24.10.2026)
- `trips`: ~75, `trip_segments`: ~98, `trip_cargo`: ~78, `trip_expenses`: ~455.
- `counters`: сплошная нумерация.
- `audit_log`: ~471+.
- **Бэкапы:** `backup_2026-10-21_0731.json` — доставлен в Telegram ✅. Cron работает.

---

## 📋 Шпаргалка
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Тикет `SU-516613`:** ЗАКРЫТ (ложный, опечатка).
- **Vercel:** лимит Hobby (100/сутки) + GitHub Outage.
- **Скорость:** 94/100 (до миграции), после Next.js 15 — быстрее.
- **Линт:** `npm run lint` (ESLint CLI, не `next lint`). `0 errors, 0 warnings`. При билде отключён через `ignoreDuringBuilds`.
- **`package.json` overrides:** `postcss: "^8.5.23"`, `glob: "10.5.0"`. `postcss` также в `devDependencies` с той же спецификацией (иначе `EOVERRIDE`).
- **`eslint.config.mjs`:** `FlatCompat` + `compat.extends('next/core-web-vitals')`. `.next` в ignores.
- **`exceljs`:** в `dependencies`, ленивый импорт в клиентах, статический — в API.
- **`npm audit`:** 3 moderate (`postcss-selector-parser` через Tailwind 3) — принятый dev-риск.

**Закрыто:** Фазы 3.1–3.15, DNS Supabase, merge подрядчиков, фильтры `/reports`, чистка схемы, оптимизация бандлов, аудит пакетов, миграция на Next.js 15 + React 19, рефакторинг карточки рейса, **аудит зависимостей**, **ремонт линта (54 → 0)**, **миграция на `exceljs`**.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас (текущая задача).
3. Сам файл, целиком.
4. Дальше по одному файлу.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
