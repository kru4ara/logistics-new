# HANDOVER — Logistics CRM (20.10.2026)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: `kru4ara/logistics-new` (master) — автокоммит на каждое изменение
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: `smodijsjwcvsscfgloh`
- Vercel project: `kru4aras-projects/logistics-new`

### ENV (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — клиент, RLS закрыт
- `SUPABASE_SERVICE_ROLE_KEY` — server client, обходит RLS
- `LOGISAT_SERVER` / `LOGISAT_USERNAME` / `LOGISAT_PASSWORD`
- `TELEGRAM_BOT_TOKEN` — @raibuilding_bot
- `TELEGRAM_CHAT_ID` — общий чат офиса
- `TELEGRAM_WEBHOOK_SECRET`
- `CRON_SECRET`

**Vercel Secret-переменные не редактируются** — только удалить + создать заново + Redeploy.

---

## ⚠️ Правила работы с AI-ассистентом (читать первым!)

### Контекст чата — не бесконечный
Окно ~200k токенов. Загрузка крупных файлов, бэкапов, полных HANDOVER'ов и логов **быстро съедает запас**. Когда переполняется — ассистент теряет **начало** чата (HANDOVER, договорённости), а не конец. Начинает противоречить сам себе.

### Что НЕ грузить в чат
- Бэкапы БД (`backup_*.json`) — 200–300 KB мёртвого груза
- Старые версии HANDOVER
- Уже заменённые файлы
- Логи билдов целиком
- Огромные JSON/дампы

### Что грузить
- Только файлы, которые **сейчас правим** (по одному)
- Актуальный HANDOVER — **один раз в начале**
- Результат grep (**список**, не содержимое)
- Короткий скриншот ошибки

### Сигналы о состоянии контекста
- 🟢 **Зелёный** — работаем
- 🟡 **Жёлтый** — ~30–40%, «пора подумать о сохранении»
- 🔴 **Красный** — «сейчас обновляем HANDOVER и новый чат»

### Когда сохраняться
На **границах логических блоков**, не на середине файла.

### Как начинать новый чат
1. Полный HANDOVER
2. Что делаем сейчас
3. Сам файл
4. Дальше — по одному файлу

### Рабочий процесс
- Полные файлы на замену, не куски
- 1 шаг за раз
- НЕ пишем вслепую — просим актуальную версию
- Полные коды одним блоком
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Server components → `createClient()` из `lib/supabase-server`
- Пути импортов:
  - `app/X/page.tsx` → `../../lib/`, `../../components/`
  - `app/X/[id]/page.tsx` → `../../../lib/`, `../../../components/`
  - `app/X/[id]/edit/page.tsx` → `../../../../lib/`, `../../../components/`
  - `app/X/Y/page.tsx` → `../../../lib/`
- **Один коммит = связанные файлы** (иначе Vercel падает на type-check)

### ⚠️ Правки через GitHub Web UI
- Карандаш → выделить всё → вставить → Commit
- Локальный клон `~/projects/logistics-new` отстаёт — перед grep делать `git pull`
- grep: `https://github.com/kru4ara/logistics-new/search?q=ТЕРМИН&type=code`

### ⚠️ Git и локальная работа
- В Git Bash настроен `user.name` и `user.email` (глобально).
- Если `git push` выдаёт `rejected` — сделать `git pull`, решить конфликты (если есть), затем `git push`.
- Если случайно открылся Vim при коммите без `-m`: `Esc` → `:wq` → `Enter`.
- **Всегда** пиши `git commit -m "Текст"`, чтобы не открывался редактор.
- Если в коммит попал `node_modules` — `git reset HEAD~1`, добавить `node_modules/` в `.gitignore`, `git rm -r --cached node_modules`, затем заново `git add` и `git commit`.

### ⚠️ Урок: при миграции колонок — grep всех `.select()`
После миграции `drivers.phone` → `phone_by`/`phone_pl` (Фаза 4.2) `/today` падал в рантайме: `column drivers_1.phone does not exist`. Билд был зелёным (TS SQL не проверяет).
**Правило:** при удалении колонки — grep её имени **во всех** `.select(...)` в `app/` и `lib/`.

---

## 🎨 Дизайн-система

### Палитра (`tailwind.config.js`)
- `brand` — индиго/фиолет (`bg-brand-600`, `text-brand-600`, `hover:bg-brand-700`)
- `accent` — фиолетовый (градиенты с brand)
- `ink` — тёмный (`bg-ink-900` = `#0f172a`)
- `rounded-3xl` переопределён на `1.25rem` (20px)

### Тени
`shadow-brand-sm`, `shadow-brand`, `shadow-brand-lg` (индиго), `shadow-soft`, `shadow-soft-lg` (серые)

### Анимации
`fade-in` (200ms), `slide-up` (250ms), `slide-down` (200ms), `scale-in` (150ms), `shimmer` (2s linear)

### Утилиты (`app/globals.css`)
`.card`, `.card-hover`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.badge`, `.skeleton`, `.scrollbar-thin`

`.input` — с `focus:ring-brand-500` и `text-base` (iOS не зумит)

### Иконки
Lucide-react `^0.460.0` — везде. Emoji только в `<option>`, логах/Telegram, `CATEGORY_META`.

---

## 📁 Структура проекта

### Гибкая модель рейсов (грузы + сегменты) — АКТИВНА

**`trip_cargo`**: `id`, `trip_id`, `position`, `label`, `cargo_type`, `weight_kg`, `pallets`, `client_id`, `notes`, `from_*`, `to_*`, `customs_place`, `customs_country`, `customs_city`, `customs_postal_code`, `customs_address`, `customs_lat`, `customs_lng`, `freight_amount`, `freight_currency`, `created_at`

**`trip_segments`**: `id`, `trip_id`, `position`, `executor_type` (`'us'` | `'contractor'`), `contractor_id`, `truck_id`, `trailer_id`, `driver_id`, `date_from`, `date_to`, `from_*`, `to_*`, `stops` JSONB, `price`, `currency`, `notes`, `contractor_truck_number`, `contractor_driver_name`, `contractor_payment_days`, `contractor_payment_document_type`, `contractor_transport_type`, `contractor_transport_temperature`, `contractor_transport_height`, `created_at`

**`trip_segment_cargo`**: `segment_id`, `cargo_id` (PK составной)

**`trip_expenses.segment_id`** — FK на `trip_segments` (`ON DELETE SET NULL`)

**`driver_transactions`**: `id`, `driver_id`, `trip_id`, `expense_id`, `type` (`'accrual'` | `'payout'`), `amount_eur`, `original_amount`, `currency`, `date`, `notes`, `created_at`

**`counters`**: `name` (PK), `last_value` — для сплошной нумерации рейсов

### Удалённые таблицы
- `trip_subcontractors` — DROP (Фаза 3.3)

### Удалённые колонки из `trips` (Фаза 3.6.7)
`sender_*`, `sender2_*` … `sender5_*`, `receiver_*`, `route` — **37 колонок**

### Удалённые колонки из `drivers` (Фаза 4.2)
- `phone` → `phone_by`, `phone_pl`

### Добавленные колонки
- `trips.created_at` (15.10)
- `trip_expenses.paid_by_driver` (15.10)
- `trucks.tachograph_last_download` (15.10)
- `drivers.driver_card_last_download` (15.10)
- `drivers.passport_series` (16.10)
- `drivers.passport_issued_date` (16.10)
- `drivers.passport_issued_by` (было)
- `trip_cargo`: `pallets`, `customs_*`, `freight_amount`, `freight_currency` (20.10)
- `trip_segments`: `contractor_*` (truck/driver/payment/transport), `contractor_transport_height`, `trailer_id` (20.10)

### Триггеры и функции
- **`counters` + `next_trip_number()`** — монотонная нумерация без дырок
- **`assign_trip_number_on_segment()` + `trg_assign_trip_number_on_segment`** — присваивает `trip_number` при появлении us-сегмента с машиной и водителем
- **`renumber_all_trips()`** — пересчёт при удалении рейса (вызывается из `deleteTrip`)
- **`sync_trip_from_segment()` + `trg_sync_trip_from_segment`** — синхронизирует `trips.truck_id/driver_id/start_date/end_date` из `trip_segments` (для Logisat/DOCX)

### Хелперы
- **`lib/trip-route.ts`** — `buildRouteMap(segments)`
- **`lib/geocode.ts`** — `geocode(city, country, postalCode?)` (postal_code + viewbox + countrycodes + cleanCity)
- **`lib/trip-renumber.ts`** — `renumberAllTrips()` больше не вызывается (триггер)
- **`lib/trip-task-text.ts`** — `DriverInfo` с `phone?`, `phone_by?`, `phone_pl?`
- **`lib/translate-pl.ts`** — `translateToPl(text)` — словарь перевода на польский (грузы, типы)
- **`lib/company.ts`** — `COMPANY`, `APP_URL`, `getTerms(paymentDays, docType)` (текст условий на польском)

---

## 🔒 Закрытые фазы

### Фаза 3.1 — удалён `/trips-test`
### Фаза 3.2 — уведомления / DOCX 'us'-сегментов
### Фаза 3.3 — legacy cleanup + DROP `trip_subcontractors`
### Фаза 3.5 — переход на `trip_segments` (3.5.1–3.5.7, Пакеты A, B, C)

### Фаза 3.6 — DROP COLUMN legacy — ✅ 14.10
- 3.6.1–3.6.6 — код
- 3.6.7 — SQL DROP COLUMN (37 колонок)

**Legacy sender→receiver мертва.**

### Фаза 4 — Расчёты с водителями — ✅ 15.10
- 4.1 — SQL `driver_transactions` + экшены
- 4.2 — accrual при `paid_by_driver`/`salary`
- 4.3 — блок «Расчёты» на `/drivers/[id]`
- 4.4 — `/driver/balance` + карточка

### Фаза 5 — Переделка создания рейса (груз первичен) — ✅ 20.10
- Новая модель: заявка создаёт `trip` (обёртка) + `trip_cargo` (груз). Сегмент — потом.
- `createCargoWithTrip` в `geocode-actions.ts`. Старый `addTripWithAddress` помечен `@deprecated`.
- Сплошная нумерация через `counters` (без дырок).
- `EditTripForm` очищен от транспорта (без дублирования с сегментами).
- `SegmentForm`: таможня как промежуточная точка, фильтр локаций, польские поля подрядчика, прицеп.
- `TripCargoBlock` + `CargoForm`: паллеты, таможня, фрахт.
- Список `/trips`: сортировка по дате (новые сверху), бездатные — в секции «Без номера», фильтры в селектах (компактно), фильтр по клиентам.
- DOCX: польский, Palety, Dane pojazdu, `translateToPl`, `getTerms(paymentDays, docType)`.
- Оптимизация: индексы в БД, `prefetch={false}` для карточек, скелетон загрузки, Speed Insights.

---

## ⏭️ Сделано (15.10–20.10.2026)

### 15.10.2026
1. `created_at` в `trips` — SQL.
2. Триггер `trip_number` (MAX+1). Убраны вызовы `renumberAllTrips`.
3. Считывание тахографа + карты водителя — карточки + формы + `/driver/reminders` (с прицепом) + `/reminders` (офис).
4. Сортировка `/trips` — «Последние созданные».
5. Миграция `phone` → `phone_by`/`phone_pl` — 7 файлов.

### 16.10.2026
6. **Визитка водителя + фото паспорта**:
   - `app/drivers/[id]/page.tsx` — фото паспорта (горизонтальное, клик → full-size)
   - `app/components/DriverPassportUpload.tsx` — «📷 Добавить/Сменить фото»
   - `replaceDriverPassport()` — удаляет старые, загружает новое
7. **Реорганизация sidebar водителя** — Logisat, Статистика, Расчёты + упрощение `/driver`

### 18.10.2026
8. **Проверка дубликатов** — `check-duplicates`, `DuplicateChecker`, SQL: 0 дубликатов.
9. **Косметика:** `sender_*`/`receiver_*` убраны из `map/page.tsx`, `map/MapView.tsx`, `today/page.tsx`.
10. **Считывание в офисном `/reminders`** — секция «📥 Считывание тахографа и карт».
11. **Онбординг админа** — `admin-onboarding-actions.ts`, `AdminOnboardingCard.tsx`, `/page.tsx`.

### 19.10.2026
12. **Фикс `/today`** — `phone_by, phone_pl` вместо `phone`.
13. **Поиск + фильтр статуса в `/driver`** — `searchParams.q` + `searchParams.status`.

### 20.10.2026 (главное)
14. **Новая модель создания рейса:**
    - `/trips/new` → заявка/груз (клиент, маршрут, таможня, груз, фрахт).
    - `createCargoWithTrip` — атомарно `trips` + `trip_cargo`, без сегмента.
    - `addTripWithAddress` помечен `@deprecated`.
15. **SQL:**
    - `trip_cargo`: `pallets`, `freight_amount`, `freight_currency`, `customs_*`.
    - `trip_segments`: `contractor_*` поля, `contractor_transport_height`, `trailer_id`.
    - `locations.type`: добавлен `'customs'`.
    - `counters` + `next_trip_number()` — сплошная нумерация без дырок.
    - `renumber_all_trips()` — вызывается из `deleteTrip`.
    - `sync_trip_from_segment` — для Logisat/DOCX.
    - Индексы на `trips(client_id)`, `trips(driver_id)`, `trips(truck_id)`, `trips(start_date)`.
16. **UI:**
    - Список `/trips`: новые сверху, бездатные («Без номера») — отдельно, компактные фильтры (селекты в 2 колонки), фильтр по клиентам.
    - `EditTripForm`: убраны тягач/прицеп/водитель/даты/фрахт (без дубликатов).
    - `SegmentForm`: таможня как промежуточная точка, фильтр локаций по типу, польские поля подрядчика, тип транспорта (Standard/Mega/Chłodnia + температура/высота), прицеп.
    - `CargoForm` + `TripCargoBlock`: паллеты, таможня, фрахт.
    - `locations/page.tsx` + `[id]/edit/page.tsx` + `new/page.tsx`: тип «Таможня».
17. **DOCX для подрядчика:**
    - `lib/translate-pl.ts` — перевод названий грузов и типов на польский.
    - `docx/route.ts`: Palety, Dane pojazdu, `#1 ZAŁADUNEK`, `#2 ODPRAWA CELNA`, `#3 ROZŁADUNEK`.
    - `getTerms(paymentDays, docType)` — условия под сканы/оригиналы.
18. **Оптимизация:**
    - `prefetch={false}` для карточек рейсов.
    - `app/trips/loading.tsx` — скелетон загрузки.
    - Speed Insights подключён (`@vercel/speed-insights`).
    - SQL индексы для фильтрации.

---

## 📈 Состояние скорости (20.10.2026)

- **Vercel Speed Insights (Desktop, P75):** **94/100** (зелёная зона, «Great»). Более 75% визитов — отличный опыт.
- **PageSpeed Insights (Desktop):** 83/100 (хорошо, близко к зелёной зоне).
- **Главная рекомендация PageSpeed:** «Удалить неиспользуемый JS» (~165 КБ). Это статический вес первого визита, на повторных заходах берётся из кэша (все скрипты `(disk cache)`, время 6–16 мс). **Не критично.**
- **Регион Vercel:** `Washington, D.C. (iad1)` — не меняли, так как TTFB в норме (Speed Insights 94).
- **`next.config.js`:** не менялся (только `serverActions.bodySizeLimit`). Опция `optimizePackageImports` не применялась (не требуется).

---

## ⏭️ Очередь задач (не срочно)

| № | Задача | Размер |
|---|---|---|
| 1 | Удалить `addTripWithAddress` (`@deprecated`) из `geocode-actions.ts` | 10 мин |
| 2 | Поиск в `/trips` по `from_loading_number`, `to_loading_number`, `customs_place` | 30 мин |
| 3 | Блокировка Logisat-синка для рейсов без `trip_number` | 30 мин |
| 4 | `trailer_id` в задании водителю (`trip-task-text.ts`) | 30 мин |
| 5 | Массовый пересчёт координат (кнопка `/trips`) | 1 час |
| 6 | Слияние дубликатов (merge tool) | Средний |
| 7 | Фото водителя в `/drivers` — превью в списке | 1 час |
| 8 | Grep-аудит `.select()` после миграций | 30 мин |
| 9 | Оптимизация JS-бандла (если захочется дожать PageSpeed до 90+) | 1 час |

---

## 📊 Состояние данных (20.10.2026)

- `trips`: ~75 (+ `created_at`, `trip_number` через `counters`)
- `trip_segments`: ~100 (с новыми полями подрядчика и `trailer_id`)
- `trip_cargo`: ~75 (+ `pallets`, `customs_*`, `freight_*`)
- `trip_segment_cargo`: ~80
- `trip_expenses`: ~416
- `driver_transactions`: наполняется
- `trip_subcontractors`: DROP
- `counters`: `last_value` для `trip_number`

**Бэкапы:** `backup_2026-10-13_0730.json`, `backup_2026-10-14_0607.json`, `backup_2026-10-14_0730.json`. Cron `/api/cron/backup` — 7:00.

---

## Что работает

### Авторизация
Login через server action + `bcrypt.compare` + httpOnly cookie. Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx`. RLS включён.

### Домены
- Рейсы + сегменты + грузы + расходы + документы
- Экспедирование (orders + contractors + points + expenses)
- Клиенты, водители, тягачи, прицепы, локации (с таможней), подрядчики
- Напоминания + cron Telegram
- Logisat (синк, bulk-синк)
- Курсы валют, документы
- **Расчёты с водителями** (`driver_transactions`)
- **Проверка дубликатов** (`/api/check-duplicates`)
- **Геокодирование с postal_code**
- Бэкапы 18 таблиц

### Прочее
- `/today` — KPI, события, «Требует внимания»
- `/reports/logisat` — ошибки
- Онбординг водителя + **онбординг админа**
- Bulk-операции, CSV-экспорт, проверка пересечений
- **Заявки без номера** (секция в списке)
- **Документы подрядчику на польском** (ZLECENIE)
- **Speed Insights** (Vercel)

### Cron
- `/api/update-rates` — `0 6 * * *`
- `/api/cron/reminders` — `0 9 * * *`
- `/api/cron/backup` — `0 7 * * *`

---

## Подводные камни

### PostgREST и FK
У `trips` два FK на `trucks` (`truck_id`, `trailer_id`). Алиасы обязательны: `.select('*, trucks!truck_id(...), trucks!trailer_id(...)')`. То же для `trip_segments` (алиас `trailer:trucks!trailer_id(...)`).

### Supabase SQL Editor: `DROP COLUMN a, b, c`
**Не работает**. **Решение:** `DROP COLUMN` перед каждой колонкой.

### Миграция колонок → grep ВСЕХ `.select()`
После `drivers.phone` — `/today` падал в рантайме, билд зелёный. **Правило:** при DROP COLUMN — grep во всех `.select()` в `app/` и `lib/`.

### Геокодирование — Nominatim путается
«Nola (NA), Italy» → «Nola, Louisiana». **Решение:** `postal_code` + `viewbox` + `countrycodes` + `cleanCity`.

### `recalcTripCoords`
При пересчёте — селектим `from_postal_code, to_postal_code` в сегментах.

### Таймауты Vercel-билдов
Static page generation 60s. Лечится: Redeploy без кэша.

### Автокоммит
Каждое изменение = коммит + билд. **Связанные файлы — один коммит**.

### Потеря импорта / обрыв при копипасте
Не удалять существующие импорты. Проверять, что файл дошёл до конца (`}`).

### `driver.phone` больше нет
Все `.select()` с `drivers!driver_id(..., phone)` → `phone_by, phone_pl`.

### DOCX: перевод на польский
`lib/translate-pl.ts` — словарь. Если слово не найдено, остаётся как есть. Пополнять по мере необходимости.

### `getTerms(paymentDays, docType)`
Тип документов (`'originals' | 'scans'`) влияет на текст пункта 1 в WARUNKI ZLECENIA.

### Speed Insights
Пакет `@vercel/speed-insights` установлен через `npm i`. Компонент `<SpeedInsights />` в `layout.tsx` (внизу `<body>`). Включён в панели Vercel.

### Git (локально)
- В Git Bash настроены `user.name` / `user.email`.
- При `git push` с ошибкой `rejected` — сделать `git pull`, затем `git push`.
- Всегда `git commit -m "Текст"` (чтобы не открывался Vim).
- Если в коммит попал `node_modules` — `git reset HEAD~1`, добавить в `.gitignore`, `git rm -r --cached node_modules`, заново `git add`/`commit`.

---

## 📋 Шпаргалка

- `trips`: ~75, `trip_segments`: ~100, `trip_cargo`: ~75, `trip_expenses`: ~416
- `driver_transactions`: наполняется
- `trip_subcontractors`: DROP
- `counters`: сплошная нумерация
- Скорость: **94/100** (Speed Insights Desktop)

**Закрыто:** Фазы 3.1–3.6, Фаза 4, Фаза 5 (груз первичен), `created_at`, нумерация через `counters`, считывание тахографа/карт, визитка водителя, sidebar водителя, дубликаты, онбординг админа, геокодирование с postal_code, фикс `/today`, поиск в «Мои рейсы», таможня (в карточке и сегментах), прицеп в сегменте, DOCX на польском (Palety, Dane pojazdu, условия под сканы/оригиналы), компактные фильтры + клиенты, Speed Insights, индексы БД, `prefetch={false}`.

---

## 🆕 Условие работы с AI-ассистентом

**При старте нового чата:**
1. Полный HANDOVER (один раз)
2. Что делаем сейчас
3. Сам файл, целиком
4. Дальше по одному файлу

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».

**Сохраняемся на границах блоков.**

**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON.

**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.

**Цель:** непрерывность через короткие чаты, каждый стартует с полного HANDOVER.
