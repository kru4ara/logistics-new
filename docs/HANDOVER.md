# HANDOVER — Logistics CRM (21.10.2026, вечер)

## Стек и инфраструктура
- Next.js 14.2.35 (App Router) + Supabase + Vercel
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
- `TELEGRAM_CHAT_ID` — `921520481` (личка владельца)
- `TELEGRAM_WEBHOOK_SECRET`
- `CRON_SECRET`

**Vercel Secret-переменные не редактируются** — только удалить + создать заново + Redeploy. `vercel env pull` не вытаскивает Secret (write-only).

---

## ✅ Блокер DNS Supabase — ЗАКРЫТ (21.10.2026)
**Причина:** опечатка в Project ref (`smodijsjwvsscfgloh` без `i` вместо `smodijsj`**`i`**`wcvsscfgloh`).
**Решение:** исправлено в `.env.local` и Vercel.
**Статус:** локальный `npm run dev` работает, прод работает. Тикет `SU-516613` закрыт автоматически (был ложным, не на стороне Supabase).

---

## ⚠️ Важно: Vercel Hobby Лимит (100 деплоев/сутки)
Если после `git push` Vercel не запускает билд («спит»), это **исчерпан лимит деплоев** (Hobby план).
**Решения:**
1. Ждать 24 часа (лимит сбрасывается).
2. `git commit --allow-empty -m "trigger"` + `git push`.
3. Сделать **Redeploy** вручную через GitHub (иконка Vercel у коммита) или в панели Vercel.
4. Запустить `npx vercel --prod` из Git Bash (иногда обходит лимит Git-интеграции).
5. **Не делать `npm audit fix --force`** — это может сломать проект.

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
2. Что делаем сейчас (см. Очередь задач)
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
- При `git push` с ошибкой `rejected` — сделать `git pull --no-edit`, затем `git push`.
- Всегда `git commit -m "Текст"` (чтобы не открывался Vim).
- Если конфликт в `package.json` — **оставлять нашу версию** (с алиасами и обновлениями).
- Если редактор не сохраняет файл (или остались маркеры `<<<<<<<`) — использовать `cat > file << 'EOF' ... EOF` в Git Bash.
- Если в коммит попал `node_modules` — `git reset HEAD~1`, добавить в `.gitignore`, `git rm -r --cached node_modules`, заново `git add`/`commit`.

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

### Удалённые колонки (Фаза 10, 21.10)
- `trip_expenses.subcontractor_id` — DROP (висячая колонка от `trip_subcontractors`).
- `forwarding_orders.route_from`, `route_to` — DROP (заменены на `forwarding_points`).

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
- **`merge_contractors(source_id, target_id)`** — атомарное объединение подрядчиков (переносит `trip_segments.contractor_id`, `forwarding_contractors.contractor_id`, удаляет дубликат). `trip_expenses.subcontractor_id` НЕ трогает — висячая колонка.

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

### Фаза 8 — Merge tool для подрядчиков — ✅ 21.10
- SQL `merge_contractors(source_id, target_id)` — переносит `trip_segments.contractor_id`, `forwarding_contractors.contractor_id`, удаляет дубликат.
- `mergeContractors` в `app/contractors/actions.ts` (файл называется `actions.ts`, НЕ `contractor-actions.ts`).
- `MergeContractorDialog.tsx` + `ContractorCardActions.tsx` + кнопка «Объединить» на `/contractors`.
- `trip_expenses.subcontractor_id` НЕ трогаем — висячая колонка от DROP `trip_subcontractors` (FK нет, UUID-ов в `contractors` нет — проверено).
- **Тест на проде:** ✅ пройден 21.10 (кнопки видны, модалка работает, список подтягивается).

### Фаза 9 — Фильтры на `/reports` — ✅ 21.10
- Период (с/по), статус (по умолчанию `money` = `paid`+`invoiced`), клиент.
- Экспорт XLSX учитывает фильтры автоматически.
- Счётчики и таблица пересчитываются по отфильтрованным.

### Фаза 10 — Оптимизация бандла и аудит безопасности — ✅ 21.10
- **Next.js:** `14.2.0` → **`14.2.35`** (закрыты критические CVE: Cache Poisoning, SSRF, DoS).
- **`xlsx`:** `0.18.5` (npm) → **`0.20.3` (CDN SheetJS)** (Prototype Pollution, ReDoS).
- **`image-size`:** заменён на **`safe-image-size@1.2.1`** через алиас в `dependencies` (DoS). Из-за ошибки `EOVERRIDE` с `overrides` пришлось прописать алиас напрямую.
- **Ленивый `xlsx`** в `DownloadButton` (reports, routes, trips) — грузится только по клику.
- **Ленивый `TripsBulkList`** через `nextDynamic` (чтобы не было конфликта с `export const dynamic = 'force-dynamic'`).
- **`sharp`** установлен (оптимизация картинок).
- **`SearchInput`** — исправлен плейсхолдер (поиск только по номеру рейса/заявки).
- **`next.config.js`**: `optimizePackageImports` = `['lucide-react', 'docx', 'qrcode', 'image-size']` (убран `recharts`, его нет в проекте).
- **Результат бандлов:**
  - `/trips`: 204 kB → **113 kB**
  - `/reports`: 190 kB → **97.7 kB**
  - `/routes`: 190 kB → **97.5 kB**
- **Аудит:** 20 уязвимостей → **14** (оставшиеся — транзитивные внутри Next 14, уйдут при переходе на 15).

---

## ⏭️ Сделано (15.10–21.10.2026)

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

### 21.10.2026 (день)
30. **DNS Supabase — закрыт.** Причина — опечатка Project ref (без `i`). Исправлено в `.env.local` + Vercel. Локальный `dev` работает. Тикет `SU-516613` закрыт.
31. **Бэкап в Telegram — проверен.** `backup_2026-10-21_0731.json` (1751 строка) доставлен в личку. Cron работает.
32. **Grep-аудит `.select()` — закрыт.** Найден 1 баг: `app/trips/[id]/task-actions.ts:277` — `.select('id, trip_number, route, ...')` падал на удалённой `trips.route`. Исправлено (убрано `route` из селекта).
33. **`task-actions.ts` — фикс задания водителю.**
    - Убран мёртвый `route` из `.select()` в `sendSegmentTaskToDriver`.
    - Добавлены `truck_reg` / `trailer_reg` в сегменты **в обеих функциях** (`sendTaskToDriver` и `sendSegmentTaskToDriver`) — теперь в Telegram-задании выводится блок «🚚 Машина: … / прицеп …», как в превью на странице. Раньше не выводился (расхождение с `page.tsx`).
    - В `sendTaskToDriver` тягач/прицеп сегмента берутся встроенным join'ом: `select('*, trucks!truck_id(registration_number), trailers:trucks!trailer_id(registration_number)')`.
34. **`next.config.js` — чистка.**
    - `optimizePackageImports`: убран `recharts` (не установлен). Осталось: `['lucide-react', 'docx', 'qrcode', 'image-size']`.
    - `serverActions.bodySizeLimit: '10mb'` — без изменений.
35. **Merge tool для подрядчиков — Фаза 8.** См. выше.
36. **Фильтры на `/reports` — Фаза 9.** См. выше.
37. **Оптимизация бандла и аудит безопасности — Фаза 10.** См. выше.
    - Обновление Next.js до `14.2.35`.
    - `xlsx` с CDN (`0.20.3`).
    - `image-size` → `safe-image-size` (алиас).
    - Ленивые импорты (`xlsx`, `TripsBulkList`).
    - `sharp`.
    - Чистка `next.config.js`.

---

## 📈 Состояние скорости (21.10.2026)

- **Vercel Speed Insights (Desktop, P75):** **94/100** (зелёная зона, «Great»).
- **PageSpeed Insights (Desktop):** 83/100 (хорошо).
- **First Load JS shared:** 87.4 kB.
- **Главная:** 90.8 kB.
- **`/trips`:** 113 kB (было 204 kB).
- **`/reports`:** 97.7 kB (было 190 kB).
- **`/routes`:** 97.5 kB (было 190 kB).
- **Регион Vercel:** `Washington, D.C. (iad1)`.

---

## ⏭️ Главная задача: Миграция на Next.js 15

**Почему сейчас:** `react-leaflet@5` и `react-leaflet-cluster@4` обновились и требуют `react@^19`. Блокер снят.
**План:**
1. `npm install next@15 react@19 react-dom@19 react-leaflet@5 react-leaflet-cluster@4`
2. `npm install -D eslint-config-next@15`
3. `npm run build` — пофиксить breaking changes:
   - `params` и `searchParams` асинхронные (`await params`). Проверить все `page.tsx`.
   - `fetch` не кэшируется по умолчанию.
   - `next/dynamic` с `ssr: false` в серверных компонентах — может ругаться.
   - API `react-leaflet@5` может отличаться (проверить `MapView.tsx`).
4. Пуш, проверка на проде (особенно `/map` и `/trips`).

---

## 📊 Состояние данных (21.10.2026)
- `trips`: ~75, `trip_segments`: ~98, `trip_cargo`: ~78, `trip_expenses`: ~455.
- `counters`: сплошная нумерация.
- `audit_log`: ~471+.
- **Бэкапы:** `backup_2026-10-21_0731.json` — доставлен в Telegram ✅. Cron работает.

---

## 📋 Шпаргалка
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Тикет `SU-516613`:** ЗАКРЫТ (был ложным).
- **Аудит:** 14 уязвимостей (транзитивные в Next 14, уйдут при переходе на 15).
- **Vercel:** лимит деплоев Hobby (100/сутки).
- **Скорость:** Speed Insights 94/100, shared JS 87.4 kB.

**Закрыто:** Фазы 3.1–3.10, DNS Supabase, merge подрядчиков, фильтры `/reports`, чистка схемы, оптимизация бандлов, аудит и обновление пакетов, ленивые импорты.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас (Миграция на Next.js 15).
3. Сам файл, целиком.
4. Дальше по одному файлу.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
