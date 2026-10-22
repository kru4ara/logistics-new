# HANDOVER — Logistics CRM (22.10.2026)

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

### ⚠️ Git (локально)
- `git pull --no-edit` (избегаем Vim).
- При `rejected` — `git pull --no-edit`, потом `git push`.
- Если конфликт в `package.json` — **всегда оставлять нашу версию**.
- Если редактор не сохраняет или остались маркеры `<<<<<<<` — `cat > file << 'EOF' ... EOF` в Git Bash.
- **Git Bash склеивает команды при вставке** — выполнять строго по одной строке, без вложенных кавычек. Если начал склеивать — закрыть окно, открыть новое.
- **`sed` на JSX — запрещён.** Ломает парные теги (`<a>...</Link>`). Замены только вручную через GitHub-редактор.

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
- **`postcss`:** `overrides` + синхронизация `devDependencies` на `^8.5.23` → резолвится `8.5.31` везде `deduped` (включая `next`). `EOVERRIDE` побеждён через **одинаковую спецификацию** в обоих местах (`$postcss` не сработал, `>=` тоже).
- **`glob`:** `overrides: "10.5.0"` (прибит, не `>=`, иначе улетает в 13.x и ломает `@next/eslint-plugin-next@14`).
- **`braces` и `postcss-selector-parser`:** приняты как dev-риски (фикс только в Tailwind 4, breaking).
- **Миграция линтера:** `next lint` → ESLint CLI + ESLint 9 + flat config.
  - `npx @next/codemod@latest next-lint-to-eslint-cli .`
  - `eslint.config.mjs` через `FlatCompat` (`eslint-config-next@14.2.35` не имеет нативного flat-экспорта).
  - Установлены явно: `eslint-plugin-react-hooks`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`.
  - `eslint-config-next@15` **НЕ обновляли** — сначала ESLint 9 с 14.2.35, обновление отдельной задачей.
- **`next.config.js`:** добавлен `eslint: { ignoreDuringBuilds: true }` — развязывает деплой и линт. Vercel собирает, линт чинится отдельно.
- **Коммит `4239f29` — зелёный Production.**

---

## ⏭️ Текущая задача: ремонт линта (полный, не «заметание»)

Пользователь выбрал **полный ремонт и чистый код**. Изначально было 54 ошибки после миграции линтера. Чиним группами, по файлам, через GitHub-редактор, **без `sed`**.

### Прогресс (по блокам)

**✅ `clients` (3 файла) — чисто:**
- `app/clients/page.tsx` — `<a href="/clients/new"` (строка 63) → `<Link>`.
- `app/clients/[id]/page.tsx` — `<a href="/clients"` (105), кнопка «Редактировать» (`/clients/${clientId}/edit`), карточка рейса (`/trips/${trip.id}`) → `<Link>`.
- `app/clients/new/page.tsx` — `<a href="/clients"` (52), «Отмена» (127) → `<Link>`.

**✅ `contractors` (4 файла) — чисто:**
- `app/contractors/page.tsx` — 2 кнопки `/contractors/new`, карточка `/contractors/${c.id}` → `<Link>`.
- `app/contractors/[id]/page.tsx` — 2 ссылки `/contractors`, «Редактировать» (`/contractors/${c.id}/edit`), карточка работы (`w.href`) → `<Link>`. **`tel:` (337) и `mailto:` (346) оставлены `<a>`**.
- `app/contractors/[id]/edit/page.tsx` — 2 ссылки `/contractors` → `<Link>`.
- `app/contractors/new/page.tsx` — 2 ссылки `/contractors` → `<Link>`.

**✅ `drivers` (4 файла) + `error.tsx` — чисто:**
- `app/drivers/page.tsx` — 122, 126 (KPI, Добавить), 141 (пустое состояние), карточка `/drivers/${id}` → `<Link>`. Остался warning `<img>` (в очереди).
- `app/drivers/[id]/page.tsx` — 204, «Редактировать», карточки рейсов → `<Link>`. **`tel:` (269, 278) и `<a target="_blank">` для фото паспорта — оставлены `<a>`**.
- `app/drivers/kpi/page.tsx` — 138, мобильные карточки, ссылка в таблице → `<Link>`.
- `app/drivers/new/page.tsx` — 82, 200 → `<Link>`.
- `app/error.tsx` — 34 → `<Link>`. Добавлен `import Link`.

**⏭️ В работе: `forwarding` (4 файла):**
- `app/forwarding/page.tsx` — 211, 302 (`/forwarding/new/`).
- `app/forwarding/[id]/page.tsx` — 148 (`/forwarding/`); **`tel:` на 276, 463 — не трогать**.
- `app/forwarding/new/NewForwardingForm.tsx` — 289 (`/contractors/new/`), 441 и 490 (`/locations/new/`), 610 (`/forwarding/`).
- `app/forwarding/new/page.tsx` — 41 (`/forwarding/`).

**⏭️ Осталось после `forwarding`:**
- `trips` (5 файлов): `page.tsx` (320, 396), `[id]/page.tsx` (326 + `tel:` на 476, 485 — не трогать), `[id]/edit/page.tsx` (35), `new/NewTripForm.tsx` (390), `new/page.tsx` (37).
- `trucks` (4 файла): `page.tsx` (221, 240), `[id]/page.tsx` (183), `new/NewTruckForm.tsx` (186), `new/page.tsx` (16).
- `app/fixed-costs/page.tsx` (131), `app/locations/page.tsx` (101), `app/reminders/page.tsx` (175, 323), `app/reports/page.tsx` (360, 467).
- **`react/no-unescaped-entities`:** `app/reports/contractors/page.tsx:420` — два апострофа `'contractor'` → `&apos;contractor&apos;`.
- **`react-hooks/set-state-in-effect`** (6): `AppShellClient`, `DuplicateChecker`, `Toaster`, `OverlapWarning`, `SearchInput`, `SegmentForm`.
- **`react-hooks/static-components`** (4): `Sidebar.tsx` (`SidebarContent` внутри компонента), `today/page.tsx` (`EmptyBlock` внутри компонента — вынести на уровень модуля).
- **`react-hooks/purity`** (2): `reports/logisat/page.tsx:90`, `today/page.tsx:317` — `Date.now()` в рендере.
- **`react-hooks/immutability`** (1): `DashboardCharts.tsx:302` — `cursor += len` в `.map()`.
- **`@next/next/no-img-element`** (2 warning): `CountryFlag.tsx:119`, `drivers/page.tsx:184`.

### Правила замены `<a>` → `<Link>`
- Внутренние `href="/..."` и `href={`/...`}` → `<Link>`.
- **`tel:`, `mailto:`, `https://` — оставить `<a>`**.
- `import Link from 'next/link'` добавить в начало файла.
- Карточки-обёртки (`<a className="block ..."><div>...</div></a>`) → `<Link>` тоже (внутренняя навигация), даже если линт не ругается.

### Проверка после каждого блока
```bash
npm run lint 2>&1 | grep -i "app/<домен>" || echo "<домен> чисто"

(grep -i "app.*contractors" ловит и app/reports/contractors — использовать [\\\\/] для точного совпадения сегмента.)
```
## 📈 Состояние скорости (22.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100** (до миграции).
- **После Next.js 15:** заметно быстрее.
- **First Load JS shared:** 103 kB.
- **`/map`:** 105 kB (было 146 kB).
- **`/trips`:** 118 kB (было 204 kB).
- **`/reports`:** 114 kB (было 190 kB).

---

## ⏭️ Очередь задач (не срочно)
1. **Дочинить линт** (текущая задача, см. выше).
2. Добавить `.next` в `ignores` в `eslint.config.mjs` (ложная ошибка в сгенерированном чанке).
3. Обновить `eslint-config-next` до 15.5.x (после линта; уберёт `FlatCompat`-костыль и warning `Invalid Options`).
4. `npm audit` — остались только `braces` и `postcss-selector-parser` (dev-only, приняты).
5. Отчёт «фрахт по грузам» (если понадобится).
6. `optimizePackageImports` (добавить `react-leaflet`, если нужно).
7. Переход на `exceljs` (замена `xlsx` для чистого аудита).
8. Миграция на `eslint-config-next@16` + Next 16 (отдельная фаза, breaking).
9. `<img>` → `<Image>` в `CountryFlag.tsx`, `drivers/page.tsx` (warning).

---

## 📊 Состояние данных (22.10.2026)
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
- **Линт:** `npm run lint` (ESLint CLI, не `next lint`). При билде отключён через `ignoreDuringBuilds`.
- **`package.json` overrides:** `postcss: "^8.5.23"`, `glob: "10.5.0"`. `postcss` также в `devDependencies` с той же спецификацией (иначе `EOVERRIDE`).
- **`eslint.config.mjs`:** `FlatCompat` + `compat.extends('next/core-web-vitals')`. `.next` в ignores **не добавлен** — при следующем заходе добавить.

**Закрыто:** Фазы 3.1–3.12, DNS Supabase, merge подрядчиков, фильтры `/reports`, чистка схемы, оптимизация бандлов, аудит пакетов, миграция на Next.js 15 + React 19, рефакторинг карточки рейса, **Фаза 13 (аудит зависимостей + миграция линтера)**, ремонт `<a>` → `<Link>` в блоках `clients` и `contractors`.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас (текущий блок линта — `drivers` + `error.tsx`).
3. Сам файл, целиком.
4. Дальше по одному файлу.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
