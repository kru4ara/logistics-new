# HANDOVER — Logistics CRM (19.10.2026)

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

### ⚠️ Правки через GitHub Web UI
- Карандаш → выделить всё → вставить → Commit
- Локальный клон `~/projects/logistics-new` отстаёт — перед grep делать `git pull`
- grep: `https://github.com/kru4ara/logistics-new/search?q=ТЕРМИН&type=code`
- Связанные файлы — **один коммит** (иначе Vercel падает на type-check)

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

**`trip_cargo`**: `id`, `trip_id`, `position`, `label`, `cargo_type`, `weight_kg`, `client_id`, `notes`, `from_*`, `to_*`, `created_at`

**`trip_segments`**: `id`, `trip_id`, `position`, `executor_type` (`'us'` | `'contractor'`), `contractor_id`, `truck_id`, `driver_id`, `date_from`, `date_to`, `from_*`, `to_*`, `stops` JSONB, `price`, `currency`, `notes`, `created_at`

**`trip_segment_cargo`**: `segment_id`, `cargo_id` (PK составной)

**`trip_expenses.segment_id`** — FK на `trip_segments` (`ON DELETE SET NULL`)

**`driver_transactions`**: `id`, `driver_id`, `trip_id`, `expense_id`, `type` (`'accrual'` | `'payout'`), `amount_eur`, `original_amount`, `currency`, `date`, `notes`, `created_at`

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

### Триггеры
- `set_trip_number()` + `trg_set_trip_number` — `trip_number = MAX+1` (BEFORE INSERT на `trips`)

### Хелперы
- **`lib/trip-route.ts`** — `buildRouteMap(segments)`. Типы: `SegmentRouteRow { trip_id, position, from_city, from_country, to_city, to_country }`. `trip_id` **обязателен**, подавать сырые `*Raw`.
- **`lib/geocode.ts`** — `geocode(city, country, postalCode?)`:
  - приоритет: `postal_code + country` → `city + country` → `city`
  - `cleanCity()` убирает `(...)` из города
  - `COUNTRY_ISO` (~50 стран EN + RU)
  - `viewbox=-25,20,60,72&bounded=1` (Европа + MENA)
  - `countrycodes=` если страна найдена
- **`lib/trip-renumber.ts`** — `renumberAllTrips()` больше не вызывается (триггер)
- **`lib/trip-task-text.ts`** — `DriverInfo` с `phone?`, `phone_by?`, `phone_pl?` (все optional)

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

ЗП → `accrual`. `AddExpenseForm` — чекбокс скрыт при `salary`. Предупреждения на `/trips/[id]` + `/today`.

---

## ⏭️ Сделано (15.10–19.10.2026)

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
   - Паспортные данные, телефоны BY/PL, текущий тягач/прицеп
7. **Реорганизация sidebar водителя** — Logisat, Статистика, Расчёты + упрощение `/driver`

### 18.10.2026
8. **Проверка дубликатов**:
   - `app/api/check-duplicates/route.ts` — `name`/`tax_id`
   - `app/components/DuplicateChecker.tsx` — live-проверка
   - Вставлен в `/clients/new`, `/contractors/new`
   - SQL: **0 дубликатов** в БД
9. **Косметика:** `sender_*`/`receiver_*` убраны из `map/page.tsx`, `map/MapView.tsx`, `today/page.tsx`
10. **Считывание в офисном `/reminders`** — секция «📥 Считывание тахографа и карт»
11. **Онбординг админа**:
    - `app/admin-onboarding-actions.ts` — cookie `admin_onboarded=1`
    - `app/components/AdminOnboardingCard.tsx` — 5 плиток
    - `app/page.tsx` — показывается один раз

### 19.10.2026
12. **Фикс `/today`** после миграции `phone`:
    - `app/today/page.tsx` — `drivers!driver_id(first_name, last_name, phone)` → `phone_by, phone_pl`
    - Симптом: `column drivers_1.phone does not exist` → всё по 0
13. **Поиск + фильтр статуса в `/driver`**:
    - `searchParams.q` + `searchParams.status`
    - `matchesSearch` — номер, заявка, клиент, from/to, route
    - Чипы, форма `GET /driver?q=...`, «Ничего не найдено»

### Геокодирование — финальный фикс
`lib/geocode.ts` — `viewbox` + `postal_code` + `countrycodes` + `cleanCity`. Проблема была: «Nola, Italy» → «Nola, Louisiana» → «Nola, England».

---

## ⏭️ Очередь задач (не срочно)

| № | Задача | Размер |
|---|---|---|
| 1 | Массовый пересчёт координат (кнопка `/trips`) | 1 час |
| 2 | Слияние дубликатов (merge tool) | Средний |
| 3 | Фото водителя в `/drivers` — превью в списке | 1 час |
| 4 | Проверки после миграции — grep всех `.select()` | 30 мин |

---

## 📊 Состояние данных (19.10.2026)

- `trips`: 73 (+ `created_at`, `trip_number` через триггер)
- `trip_segments`: ~96 (71 us + 25 contractor)
- `trip_cargo`: 74
- `trip_segment_cargo`: 79
- `trip_expenses`: ~416
- `driver_transactions`: новая, наполняется
- `trip_subcontractors`: DROP

**Бэкапы:** `backup_2026-10-13_0730.json`, `backup_2026-10-14_0607.json`, `backup_2026-10-14_0730.json`. Cron `/api/cron/backup` — 7:00.

---

## Что работает

### Авторизация
Login через server action + `bcrypt.compare` + httpOnly cookie. Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx`. RLS включён.

### Домены
- Рейсы + сегменты + грузы + расходы + документы
- Экспедирование (orders + contractors + points + expenses)
- Клиенты, водители, тягачи, локации, подрядчики
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

### Cron
- `/api/update-rates` — `0 6 * * *`
- `/api/cron/reminders` — `0 9 * * *`
- `/api/cron/backup` — `0 7 * * *`

---

## Подводные камни

### PostgREST и FK
У `trips` два FK на `trucks` (`truck_id`, `trailer_id`). Алиасы обязательны: `.select('*, trucks!truck_id(...), trucks!trailer_id(...)')`

### Supabase SQL Editor: `DROP COLUMN a, b, c`
**Не работает** (`syntax error at or near "b"`). **Решение:** `DROP COLUMN` перед каждой колонкой.

### `buildRouteMap` требует `trip_id`
Подавать сырые `*Raw` из supabase.

### Миграция колонок → grep ВСЕХ `.select()`
После `drivers.phone` — `/today` падал в рантайме, билд зелёный (TS SQL не проверяет).
**Правило:** при DROP COLUMN — grep во всех `.select()` в `app/` и `lib/`.

### Геокодирование — Nominatim путается
«Nola (NA), Italy» → «Nola, Louisiana» → «Nola, England». **Решение:** `postal_code` + `viewbox` + `countrycodes` + `cleanCity`.

### `recalcTripCoords`
При пересчёте — селектим `from_postal_code, to_postal_code` в сегментах.

### Таймауты Vercel-билдов
Static page generation 60s. Лечится: Redeploy без кэша.

### Автокоммит
Каждое изменение = коммит + билд.

### Потеря импорта / обрыв при копипасте
Не удалять существующие импорты. Проверять, что файл дошёл до конца (`}`).

### `driver.phone` больше нет
Все `.select()` с `drivers!driver_id(..., phone)` → `phone_by, phone_pl`.

---

## 📋 Шпаргалка

- `trips`: 73, `trip_segments`: ~96, `trip_expenses`: ~416
- `driver_transactions`: новая
- `trip_subcontractors`: DROP

**Закрыто:** Фазы 3.1–3.6, Фаза 4, `created_at`, триггер `trip_number`, считывание тахографа/карт, визитка водителя, sidebar водителя, дубликаты, онбординг админа, геокодирование с postal_code, фикс `/today`, поиск в «Мои рейсы».

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
