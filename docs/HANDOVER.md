# HANDOVER — Logistics CRM (20.10.2026, вечер)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: `kru4ara/logistics-new` (master) — автокоммит на каждое изменение
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: `smodijsjiwcvsscfgloh` (в Supabase Dashboard называется `logistics-core`, org `Raibuilding`)
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

**Vercel Secret-переменные не редактируются** — только удалить + создать заново + Redeploy. `vercel env pull` не вытаскивает Secret (write-only).

---

## 🚨 Текущий блокер: DNS Supabase

**Симптом:** проект `smodijsjwvsscfgloh` показывает «Healthy» в Dashboard, но домен `smodijsjwvsscfgloh.supabase.co` возвращает **NXDOMAIN** (не резолвится). Локальный `npm run dev` не может подключиться к базе.

**Проверено:**
- `nslookup ... 8.8.8.8` → `Non-existent domain`
- `nslookup ... 1.1.1.1` → `Non-existent domain`
- Проект **не на паузе** (Active), статус Supabase — «fully operational».
- `.env.local` содержит правильный URL (`smodijsjwvsscfgloh`, не опечатка).

**Что сделано:**
- Открыт тикет в поддержку Supabase: **`SU-516613`**, conversation ID `cnv_1opuwaji`.
- В форме привязки выбран проект `logistics-core` (`smodijsjwvsscfgloh`), issue = `Other`.
- Ожидаем ответа инженера (перерегистрация DNS-записи API-шлюза).

**Прод работает** — Vercel-функции используют альтернативный пул соединений (Supavisor), он резолвится даже при «лежащем» API-домене.

**Что делать завтра:**
1. Проверить почту / Supabase Dashboard → Support → тикет `SU-516613`.
2. Если ответили — выполнить инструкцию (перерегистрация DNS или workaround).
3. Проверить, пришёл ли бэкап в Telegram (`921520481`) в 7:00 UTC.
4. После восстановления DNS — `npm run dev` заработает локально.

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
- **Секреты** (`TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` и т.д.) — если засветились, сразу перевыпустить

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
2. Что делаем сейчас (блокер — тикет `SU-516613`)
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

### ⚠️ Git (локально)
- В Git Bash настроены `user.name` / `user.email`.
- При `git push` с ошибкой `rejected` — сделать `git pull`, затем `git push`.
- Всегда `git commit -m "Текст"` (чтобы не открывался Vim).
- Если в коммит попал `node_modules` — `git reset HEAD~1`, добавить в `.gitignore`, `git rm -r --cached node_modules`, заново `git add`/`commit`.
- `.gitignore` в проекте **есть** (добавлен 20.10). Содержит `node_modules/`, `.next/`, `.env*.local`, `backup_*.json` и т.д.

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
- **`sync_trip_from_segment()` + `trg_sync_trip_from_segment`** — синхронизирует `trips.truck_id`, `trailer_id`, `driver_id`, `start_date`, `end_date` из `trip_segments` (для Logisat/DOCX)
- **`merge_clients(source_id, target_id)`** — атомарное объединение клиентов (переносит `trips.client_id`, `trip_cargo.client_id`, `forwarding_orders.client_id`, удаляет дубликат)

### Хелперы
- **`lib/trip-route.ts`** — `buildRouteMap(segments)`
- **`lib/geocode.ts`** — `geocode(city, country, postalCode?)` (postal_code + viewbox + countrycodes + cleanCity)
- **`lib/trip-renumber.ts`** — `renumberAllTrips()` больше не вызывается (триггер)
- **`lib/trip-task-text.ts`** — `buildDriverTaskText(...)`, типы `DriverInfo` (с `phone_by?`, `phone_pl?`), `SegmentInfo` (с `truck_reg?`, `trailer_reg?`), `StopItem` (с `'customs'`)
- **`lib/translate-pl.ts`** — `translateToPl(text)` — словарь перевода на польский (грузы, типы)
- **`lib/company.ts`** — `COMPANY`, `APP_URL`, `getTerms(paymentDays, docType)` (текст условий на польском)
- **`lib/audit.ts`** — `AuditAction` = `'create' | 'update' | 'delete' | 'status_change' | 'merge'`; `logAudit`, `diffFields`
- **`lib/cron-alert.ts`** — `sendCronAlert`, `sendCronSummary` (Telegram)
- **`lib/telegram.ts`** — `notifyTelegram(text, options)`, `DEFAULT_TELEGRAM_CHAT_ID`

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
- `createCargoWithTrip` в `geocode-actions.ts`. Старый `addTripWithAddress` **удалён**.
- Сплошная нумерация через `counters` (без дырок).
- `EditTripForm` очищен от транспорта (без дублирования с сегментами).
- `SegmentForm`: таможня как промежуточная точка, фильтр локаций, польские поля подрядчика, прицеп.
- `TripCargoBlock` + `CargoForm`: паллеты, таможня, фрахт.
- Список `/trips`: сортировка по дате (новые сверху), бездатные — в секции «Без номера», фильтры в селектах (компактно), фильтр по клиентам, поиск только по `trip_number` и `client_request_number`.
- DOCX: польский, Palety, Dane pojazdu, `translateToPl`, `getTerms(paymentDays, docType)`.
- Оптимизация: индексы в БД, `prefetch={false}` для карточек, скелетон загрузки, Speed Insights.

### Фаза 6 — Утилиты и защита — ✅ 20.10 (вечер)
- Удалён мёртвый код: `addTripWithAddress`, `notifyDriverAboutNewTrip` (в `geocode-actions.ts`).
- Поиск в `/trips` — только по номеру рейса и номеру заявки.
- Блокировка `SyncLogisatButton` для рейсов без `trip_number`.
- Прицеп (`trailer_id`) в задании водителю (`lib/trip-task-text.ts`).
- Массовый пересчёт координат (`recalcAllTripsCoords` + `RecalcAllCoordsButton` с порциями по 20 и прогрессом).
- Превью фото паспорта водителя в `/drivers` (signed URLs).
- Merge tool для клиентов (`merge_clients` SQL + `ClientCardActions` + `MergeClientDialog`).
- Сторожевой бэкап: `/api/cron/backup` пишет в `audit_log` «Бэкап выполнен»; `/api/cron/backup-watch` (8:00 UTC) проверяет и шлёт алерт, если бэкапа нет.
- Авто-расчёт топлива (`calcFuelFromPrevTrip`, `tryAutofillFuel`) и даты старта (`calcSuggestedStartDate`) при добавлении us-сегмента.

### Фаза 7 — KPI водителей с прибылью — ✅ 20.10 (вечер)
- `app/drivers/kpi/page.tsx`: вместо «Фрахт» — колонка **«Прибыль»** (фрахт − все расходы).
- Запрос `trip_expenses` теперь берёт **все** категории (не только `salary`).
- Mobile: блок «Прибыль» крупно, зелёный/красный; под ним — «Рейсов» и «Фрахт / Расходы / ЗП».
- Desktop: колонки «Фрахт», «Расходы», «Прибыль» (цветная), «ЗП мес», «ЗП всего», «Пробег», «Расход».
- Сортировка — по прибыли (убывание).

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

### 20.10.2026 (день)
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
    - `sync_trip_from_segment` — для Logisat/DOCX (обновлён: добавлен `trailer_id`).
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

### 20.10.2026 (вечер — Фаза 6)
19. **Мёртвый код:**
    - Удалён `addTripWithAddress` и `notifyDriverAboutNewTrip` из `geocode-actions.ts`.
20. **Поиск в `/trips`:**
    - `matchesSearch` ищет только по `trip_number` и `client_request_number`.
21. **Logisat:**
    - `SyncLogisatButton` с пропсами `disabled`/`disabledHint`.
    - На `/trips/[id]` кнопка блокируется, если `!trip.trip_number`.
22. **Прицеп в задании:**
    - `lib/trip-task-text.ts`: `SegmentInfo` с `truck_reg?`, `trailer_reg?`; вывод прицепа в блоке us-сегмента.
    - `app/trips/[id]/page.tsx`: селект `trailers:trucks!trailer_id(registration_number)`, маппинг `trailer_reg`.
23. **Массовый пересчёт координат:**
    - `recalcAllTripsCoords(tripIds)` в `trip-actions.tsx` (макс. 20 за раз).
    - `app/trips/RecalcAllCoordsButton.tsx` — порции по 20 с прогрессом.
    - `app/trips/page.tsx` — кнопка в шапке.
24. **Превью фото водителя:**
    - `app/drivers/page.tsx`: запрос паспортов из `documents`, `createSignedUrls` (1 час), `<img>` вместо инициалов.
25. **Merge tool клиентов:**
    - SQL `merge_clients(source_id, target_id)`.
    - `mergeClients` в `client-actions.ts`.
    - `app/clients/MergeClientDialog.tsx`, `app/clients/ClientCardActions.tsx`.
    - `app/clients/page.tsx`: кнопка «Объединить».
26. **Сторожевой бэкап:**
    - `app/api/cron/backup/route.ts`: после успешной отправки пишет в `audit_log` «Бэкап выполнен».
    - `app/api/cron/backup-watch/route.ts` (8:00 UTC): проверяет наличие записи за сегодня, шлёт алерт, если нет.
    - `vercel.json`: `backup-watch` в `crons`.
27. **Топливо и дата старта:**
    - `calcFuelFromPrevTrip`, `tryAutofillFuel` — подтягивают остаток топлива с последнего рейса машины.
    - `calcSuggestedStartDate` — подсказывает `date_from` = следующий день после `end_date` последнего рейса.
    - В `createSegment`/`updateSegment` для us-сегментов вызываются автоматически.
28. **KPI водителей с прибылью:**
    - `app/drivers/kpi/page.tsx`: прибыль = фрахт − все расходы; сортировка по прибыли.
    - Запрос `trip_expenses` берёт все категории (не только `salary`).
    - Mobile: блок «Прибыль» крупно; Desktop: колонки «Фрахт / Расходы / Прибыль / ЗП мес / ЗП всего / Пробег / Расход».
29. **Инцидент с секретами (20.10):**
    - В чат были случайно отправлены `TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`, `VERCEL_OIDC_TOKEN`.
    - **Перевыпущены:** `TELEGRAM_BOT_TOKEN` (BotFather → Revoke), `CRON_SECRET` (новый), `TELEGRAM_WEBHOOK_SECRET` (новый).
    - `TELEGRAM_CHAT_ID` = `921520481` (личка владельца; общего чата офиса нет).
    - Обновлено в Vercel (Production) + Redeploy (`vercel --prod`).
    - Восстановлен вебхук: `setWebhook` → `{"ok":true,"description":"Webhook is already set"}`.
    - **Не забыть:** проверить, что завтра бэкап приходит в личку.

---

## 📈 Состояние скорости (20.10.2026)

- **Vercel Speed Insights (Desktop, P75):** **94/100** (зелёная зона, «Great»).
- **PageSpeed Insights (Desktop):** 83/100 (хорошо).
- **Главная рекомендация PageSpeed:** «Удалить неиспользуемый JS» (~165 КБ). Статический вес первого визита, на повторных заходах — из кэша. **Не критично.**
- **Регион Vercel:** `Washington, D.C. (iad1)` — не меняли (TTFB в норме).

---

## ⏭️ Очередь задач (не срочно)

| № | Задача | Размер |
|---|---|---|
| 1 | Дождаться ответа Supabase по тикету `SU-516613` (DNS) | — |
| 2 | Проверить бэкап в Telegram завтра в 7:00 UTC | 5 мин |
| 3 | Grep-аудит всех `.select()` после миграций | 30 мин |
| 4 | Merge tool для подрядчиков (по аналогии с клиентами) | 1 час |
| 5 | Отчёт «фрахт по грузам» (если понадобится) | Средний |
| 6 | `optimizePackageImports` в `next.config.js` (если хочется дожать PageSpeed) | 10 мин |

---

## 📊 Состояние данных (20.10.2026)

- `trips`: ~75 (+ `created_at`, `trip_number` через `counters`)
- `trip_segments`: ~100
- `trip_cargo`: ~75
- `trip_segment_cargo`: ~80
- `trip_expenses`: ~454
- `driver_transactions`: наполняется
- `trip_subcontractors`: DROP
- `counters`: `last_value` для `trip_number`
- `audit_log`: ~459+ (включая «Бэкап выполнен»)

**Бэкапы:** `backup_2026-10-13_0730.json`, `backup_2026-10-14_0607.json`, `backup_2026-10-14_0730.json`, `backup_2026-10-20_1338.json` (ручной). Cron `/api/cron/backup` — 7:00; `/api/cron/backup-watch` — 8:00.

---

## Что работает

### Авторизация
Login через server action + `bcrypt.compare` + httpOnly cookie. Таблица `users` (для офиса, колонка `login`), `drivers` (для водителей, логин = `last_name` через `ilike`). Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx`. RLS включён.

### Домены
- Рейсы + сегменты + грузы + расходы + документы
- Экспедирование (orders + contractors + points + expenses)
- Клиенты (+ merge tool), водители (с превью фото), тягачи, прицепы, локации (с таможней), подрядчики
- Напоминания + cron Telegram
- Logisat (синк, bulk-синк, блокировка без номера)
- Курсы валют, документы
- **Расчёты с водителями** (`driver_transactions`)
- **Проверка дубликатов** (`/api/check-duplicates`)
- **Геокодирование с postal_code**
- **Массовый пересчёт координат** (порциями по 20)
- **Авто-топливо и авто-дата** при добавлении us-сегмента
- **KPI водителей с прибылью**
- Бэкапы 19+ таблиц + сторожевой крон

### Прочее
- `/today` — KPI, события, «Требует внимания»
- `/reports/logisat` — ошибки
- Онбординг водителя + **онбординг админа**
- Bulk-операции, CSV-экспорт, проверка пересечений
- **Заявки без номера** (секция в списке)
- **Документы подрядчику на польском** (ZLECENIE)
- **Speed Insights** (Vercel)
- **Merge tool для клиентов**
- **Превью фото водителей**

### Cron
- `/api/update-rates` — `0 6 * * *`
- `/api/cron/backup` — `0 7 * * *`
- `/api/cron/backup-watch` — `0 8 * * *`
- `/api/cron/reminders` — `0 9 * * *`

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
Пакет `@vercel/speed-insights` установлен через `npm i`. Компонент `<SpeedInsights />` в `layout.tsx`. Включён в панели Vercel.

### Git (локально)
- В Git Bash настроены `user.name` / `user.email`.
- При `git push` с ошибкой `rejected` — сделать `git pull`, затем `git push`.
- Всегда `git commit -m "Текст"` (чтобы не открывался Vim).
- Если в коммит попал `node_modules` — `git reset HEAD~1`, добавить в `.gitignore`, `git rm -r --cached node_modules`, заново `git add`/`commit`.
- `.gitignore` в проекте есть.

### Merge tool клиентов
SQL-функция `merge_clients(source_id, target_id)` переносит `trips.client_id`, `trip_cargo.client_id`, `forwarding_orders.client_id`, удаляет дубликат. Действие необратимо.

### Сторожевой бэкап
`/api/cron/backup` пишет в `audit_log` запись с `user_name='Cron'`, `entity_type='trip'`, `summary='Бэкап выполнен: ...'` **после** успешной отправки. `/api/cron/backup-watch` ищет эту запись за сегодня (UTC) и шлёт алерт, если её нет. **Если Vercel не вызвал ни один крон — алерта не будет.** Проверять вручную.

### Авто-топливо и авто-дата
`calcFuelFromPrevTrip` / `tryAutofillFuel` берут последний рейс машины (кроме текущего) и считают `start_fuel_level = max(0, prevStart + totalRefuel - consumed)`. `calcSuggestedStartDate` даёт `date_from` = следующий день после `end_date` последнего рейса. Работают только для us-сегментов с `truck_id`. Если `start_fuel_level` уже > 0 или `date_from` задана вручную — не перезаписывают.

### Секреты (после инцидента 20.10)
- `TELEGRAM_BOT_TOKEN` перевыпущен в BotFather.
- `CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET` — новые.
- `TELEGRAM_CHAT_ID` = `921520481` (личка).
- Обновлены в Vercel (Production) + Redeploy.
- **Не грузить секреты в чат.** Если засветились — сразу перевыпускать.

### DNS Supabase (текущий блокер)
Домен `smodijsjwvsscfgloh.supabase.co` → NXDOMAIN. Проект Healthy, не на паузе. Открыт тикет `SU-516613`. Прод работает через Supavisor. Локальный `npm run dev` не работает до восстановления DNS.

---

## 📋 Шпаргалка

- `trips`: ~75, `trip_segments`: ~100, `trip_cargo`: ~75, `trip_expenses`: ~454
- `driver_transactions`: наполняется
- `trip_subcontractors`: DROP
- `counters`: сплошная нумерация
- Скорость: **94/100** (Speed Insights Desktop)
- **Supabase тикет:** `SU-516613` (DNS NXDOMAIN)

**Закрыто:** Фазы 3.1–3.6, Фаза 4, Фаза 5 (груз первичен), Фаза 6 (утилиты и защита), Фаза 7 (KPI с прибылью), `created_at`, нумерация через `counters`, считывание тахографа/карт, визитка водителя, sidebar водителя, дубликаты, онбординг админа, геокодирование с postal_code, фикс `/today`, поиск в «Мои рейсы», таможня, прицеп в сегменте и задании, DOCX на польском, компактные фильтры + клиенты, Speed Insights, индексы БД, `prefetch={false}`, массовый пересчёт координат, превью фото водителей, merge tool клиентов, сторожевой бэкап, авто-топливо, авто-дата старта, перевыпуск секретов.

---

## 🆕 Условие работы с AI-ассистентом

**При старте нового чата:**
1. Полный HANDOVER (один раз)
2. Что делаем сейчас (блокер — тикет `SU-516613`)
3. Сам файл, целиком
4. Дальше по одному файлу

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».

**Сохраняемся на границах блоков.**

**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.

**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.

**Цель:** непрерывность через короткие чаты, каждый стартует с полного HANDOVER.
