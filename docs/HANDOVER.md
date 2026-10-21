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
- Если конфликт в `package.json` — **всегда оставлять нашу версию** (с алиасами и обновлениями).
- Если редактор не сохраняет или остались маркеры `<<<<<<<` — `cat > file << 'EOF' ... EOF` в Git Bash.

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

---

## ⏭️ Сделано (15.10–22.10.2026)

### 15.10.2026
1. `created_at` в `trips` — SQL.
2. Триггер `trip_number` (MAX+1).
3. Считывание тахографа + карты водителя (напоминания).
4. Сортировка `/trips` — «Последние созданные».
5. Миграция `phone` → `phone_by`/`phone_pl`.

### 16.10.2026
6. Визитка водителя + фото паспорта (`DriverPassportUpload`).
7. Реорганизация sidebar водителя.

### 18.10.2026
8. Проверка дубликатов (`check-duplicates`).
9. Онбординг админа (`AdminOnboardingCard`).

### 19.10.2026
10. Фикс `/today` (переименование телефонов).
11. Поиск + фильтр статуса в `/driver`.

### 20.10.2026
12. Новая модель создания рейса (`createCargoWithTrip`).
13. SQL: `trip_cargo` (паллеты, фрахт, таможня), `trip_segments` (contractor_*), `counters`.
14. DOCX для подрядчика (польский, `translateToPl`).
15. Мёртвый код, поиск, Logisat блокировка, прицеп в задании.
16. Массовый пересчёт координат.
17. Превью фото водителей.
18. Merge tool клиентов.
19. Сторожевой бэкап.
20. Авто-топливо и авто-дата старта.
21. KPI водителей с прибылью.
22. Перевыпуск секретов (Telegram, Cron).

### 21.10.2026
23. **DNS Supabase — закрыт** (опечатка в ref).
24. **Бэкап в Telegram — проверен.**
25. **Grep-аудит `.select()`** (найден баг `trips.route`).
26. **`task-actions.ts`** — фикс задания водителю.
27. **Merge tool подрядчиков (Фаза 8).**
28. **Фильтры `/reports` (Фаза 9).**
29. **Оптимизация и аудит (Фаза 10).**
30. **Миграция на Next.js 15 (Фаза 11).**

### 22.10.2026
31. **Редактирование расходов:** `ExpensesList`, `EditExpenseDialog`, `expense-actions`.
32. **Верстка таблицы расходов:** `whitespace-nowrap`, `truncate`, плашки участков.
33. **Карточка рейса:** перенос кнопок статуса и телеметрии наверх.
34. **Редактирование рейса:** удалены пустые формы отправителя/получателя.
35. **Задание водителю:** почищен текст от дублей.
36. **Создание рейса:** поменяны местами «Таможня» и «Куда» (Загрузка → Таможня → Выгрузка).
37. **Форма сегмента:** починен пропадающий прицеп (через `useEffect`).

---

## 📈 Состояние скорости (22.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100** (до миграции).
- **После Next.js 15:** заметно быстрее.
- **First Load JS shared:** 103 kB.
- **`/map`:** 105 kB (было 146 kB).
- **`/trips`:** 118 kB (было 204 kB).
- **`/reports`:** 114 kB (было 190 kB).

---

## ⏭️ Очередь задач (не срочно)
1. Обновить `eslint-config-next` до 15 (убрать warning `Invalid Options`).
2. `npm audit` (проверить остатки).
3. Отчёт «фрахт по грузам» (если понадобится).
4. `optimizePackageImports` (добавить `react-leaflet`, если нужно).
5. Переход на `exceljs` (замена `xlsx` для чистого аудита).

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

**Закрыто:** Фазы 3.1–3.12, DNS Supabase, merge подрядчиков, фильтры `/reports`, чистка схемы, оптимизация бандлов, аудит пакетов, миграция на Next.js 15 + React 19, рефакторинг карточки рейса (редактирование расходов, кнопки наверх, чистка форм).

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас.
3. Сам файл, целиком.
4. Дальше по одному файлу.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
