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
**`profiles`**: `id` (FK к `auth.users`), `role` ('admin' | 'driver'), `driver_id` (FK к `drivers`), `full_name`, `created_at`.

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
- `trip-task-text.ts` — `buildDriverTaskText(...)`
- `trip-renumber.ts` — `renumberAllTrips(...)`
- `statistics.ts` — `calculateStatistics(...)`
- `profitability.ts` — `calculateProfitability(...)`
- `geocode.ts`, `translate-pl.ts`, `company.ts`, `audit.ts`, `cron-alert.ts`, `telegram.ts`
- `supabase-server.ts` — admin client (service_role, **только сервер**, защищён `import 'server-only'`)
- `supabase/server.ts` — ssr клиент с сессией
- `supabase/client.ts` — браузерный клиент

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
### Фаза 11 — Миграция на Next.js 15 + React 19 — ✅ 21.10 (вечер)
### Фаза 12 — Рефакторинг карточки рейса и UI — ✅ 22.10 (ночь)
### Фаза 13 — Аудит зависимостей и миграция линтера — ✅ 22.10 (день)
### Фаза 14 — Ремонт линта (54 ошибки → 0) — ✅ 23.10
### Фаза 15 — Миграция на `exceljs` — ✅ 24.10
### Фаза 16 — Проверка производительности и безопасности — ✅ 24.10
### Фаза 17 — Миграция на Supabase Auth — ✅ 24.10
### Фаза 18 — Улучшения UX/UI и PWA — ✅ 25.10
### Фаза 19 — Инфраструктура и тесты — ✅ 25.10
### Фаза 20 — Рефакторинг гигантских файлов — ✅ 25.10
- `SegmentForm.tsx` разбит на компоненты (`SegmentAddressBlock`, `SegmentStopsBlock`, `SegmentExecutorBlock`, `SegmentCargoSelector`).
- `statistics/page.tsx` разбит на компоненты и `lib/statistics.ts`.
- `profitability/page.tsx` разбит на `lib/profitability.ts` + тесты.

---

## 📈 Состояние скорости (25.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100**.
- **First Load JS shared:** 103 kB.
- **`/map`:** 105 kB.
- **`/trips`:** 118 kB.
- **`/reports`:** 114 kB.

---

## ⏭️ Очередь задач
1. **Защита ветки `master`** (Settings → Branches → Require status checks).
2. **Рефакторинг оставшихся гигантов:** `drivers/[id]` (34 КБ), `trips/[id]` (32 КБ), `forwarding/[id]` (31 КБ), DOCX-роуты (30 и 28 КБ).
3. **`eslint-plugin-react`** устарел для React 19 (можно заменить на `@eslint-react/eslint-plugin`).
4. **Tailwind 4 / Next 16** (breaking).

---

## 📊 Состояние данных (25.10.2026)
- `trips`: ~75, `trip_segments`: ~98, `trip_cargo`: ~78, `trip_expenses`: ~455.
- `profiles`: 3 записи (1 admin, 2 driver).

---

## 📋 Шпаргалка
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Линт:** `npm run lint` (0 errors, 0 warnings).
- **Тесты:** `npm run test` (Vitest, **28 тестов**).
- **CI:** GitHub Actions (Actions → CI).
- **`package.json` overrides:** `postcss: "^8.5.23"`, `glob: "10.5.0"`.
- **`eslint.config.mjs`:** `FlatCompat` + `compat.extends('next/core-web-vitals')`. `.next` в ignores.
- **`exceljs`:** в `dependencies`, ленивый импорт в клиентах, статический — в API.
- **`npm audit`:** 3 moderate (`postcss-selector-parser` через Tailwind 3) — принятый dev-риск.
- **Аккаунты:** админ — `raibuilding.pl@gmail.com`, водители — `vasiliuk@...`, `kavaliou@...`.
- **PWA:** установка через «Добавить на главный экран» (Chrome/Safari).

**Закрыто:** Фазы 3.1–3.20.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас.
3. Сам файл, целиком.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
