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

**Vercel Secret-переменные не редактируются** — только удалить + создать заново + Redeploy. `vercel env pull` не вытаскивает Secret (write-only).

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
Окно ~200k токенов. Загрузка крупных файлов, бэкапов, полных HANDOVER'ов и логов быстро съедает запас. Когда переполняется — ассистент теряет начало чата (HANDOVER, договорённости), а не конец.

### Что НЕ грузить в чат
- Бэкапы БД (`backup_*.json`) — 200–300 KB мёртвого груза
- Старые версии HANDOVER
- Уже заменённые файлы
- Логи билдов целиком
- Огромные JSON/дампы
- **Секреты** (`TELEGRAM_BOT_TOKEN`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` и т.д.)

### Что грузить
- Только файлы, которые сейчас правим (по одному)
- Актуальный HANDOVER — один раз в начале
- Результат grep (список, не содержимое)
- Короткий скриншот ошибки

### Сигналы о состоянии контекста
- 🟢 **Зелёный** — работаем
- 🟡 **Жёлтый** — ~30–40%, «пора подумать о сохранении»
- 🔴 **Красный** — «сохраняемся»

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
- Если редактор не сохраняет или остались маркеры `<<<<<<<` — `cat > file << 'EOF' ... EOF`.
- Если в коммит попал `node_modules` — `git reset HEAD~1`, `.gitignore`, `git rm -r --cached node_modules`.

### ⚠️ Урок: при миграции колонок — grep всех `.select()`
После `drivers.phone` — `/today` падал в рантайме, билд зелёный. **Правило:** при DROP COLUMN — grep её имени во всех `.select(...)` в `app/` и `lib/`.

---

## 🎨 Дизайн-система

### Палитра (`tailwind.config.js`)
- `brand` — индиго/фиолет (`bg-brand-600`, `text-brand-600`, `hover:bg-brand-700`)
- `accent` — фиолетовый (градиенты с brand)
- `ink` — тёмный (`bg-ink-900` = `#0f172a`)
- `rounded-3xl` переопределён на `1.25rem` (20px)

### Тени
`shadow-brand-sm`, `shadow-brand`, `shadow-brand-lg` (индиго), `shadow-soft`, `shadow-soft-lg` (серые).

### Анимации
`fade-in` (200ms), `slide-up` (250ms), `slide-down` (200ms), `scale-in` (150ms), `shimmer` (2s linear).

### Утилиты (`app/globals.css`)
`.card`, `.card-hover`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.badge`, `.skeleton`, `.scrollbar-thin`.
`.input` — с `focus:ring-brand-500` и `text-base` (iOS не зумит).

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

**`counters`**: `name` (PK), `last_value` — для сплошной нумерации рейсов.

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
- **`image-size`:** заменён на **`safe-image-size@1.2.1`** через алиас в `dependencies` (DoS).
- **Ленивый `xlsx`** в `DownloadButton` (reports, routes, trips) — грузится только по клику.
- **Ленивый `TripsBulkList`** через `nextDynamic`.
- **`sharp`** установлен.
- **`SearchInput`** — исправлен плейсхолдер.
- **`next.config.js`**: `optimizePackageImports` = `['lucide-react', 'docx', 'qrcode', 'image-size']`.
- **Результат бандлов:** `/trips`: 204→113 kB, `/reports`: 190→97.7 kB, `/routes`: 190→97.5 kB.
- **Аудит:** 20 уязвимостей → **14** (транзитивные в Next 14, уйдут при переходе на 15).

### Фаза 11 — Миграция на Next.js 15 + React 19 — ✅ 21.10 (вечер)
- **Next.js:** `14.2.35` → **`15.5.28`**.
- **React:** `18.3.1` → **`19.3.1`**.
- **React-DOM:** `18.3.1` → **`19.3.1`**.
- **react-leaflet:** `4.2.1` → **`5.0.0`**.
- **react-leaflet-cluster:** `2.1.0` → **`4.1.3`**.
- **Кодмод:** `npx @next/codemod@canary next-async-request-api .` (обработал 40 файлов, 0 ошибок).
- **Ручные фиксы:**
  - `await cookies()` — во всех 37 файлах.
  - `searchParams` → `Promise` + `await` — в 10 страницах (`audit`, `trips`, `driver`, `forwarding`, `reminders`, `reports`, `reports/profitability`, `search`, `statistics`).
  - `next/dynamic` с `ssr: false` — вынесено в клиентские обёртки (`MapViewWrapper.tsx`, `TripsBulkListWrapper.tsx`).
  - `AppShell.tsx` — `async`, `await cookies()`.
  - `layout.tsx` — `async`.
- **Результат:** билд зелёный локально и на Vercel. Прод работает заметно быстрее. `/map` упала до 105 kB.

---

## ⏭️ Сделано (15.10–21.10.2026)

### 15.10.2026
1. `created_at` в `trips` — SQL.
2. Триггер `trip_number` (MAX+1). Убраны вызовы `renumberAllTrips`.
3. Считывание тахографа + карты водителя — карточки + формы + `/driver/reminders` + `/reminders` (офис).
4. Сортировка `/trips` — «Последние созданные».
5. Миграция `phone` → `phone_by`/`phone_pl` — 7 файлов.

### 16.10.2026
6. **Визитка водителя + фото паспорта:** `app/drivers/[id]/page.tsx`, `DriverPassportUpload.tsx`, `replaceDriverPassport()`.
7. **Реорганизация sidebar водителя** — Logisat, Статистика, Расчёты.

### 18.10.2026
8. **Проверка дубликатов** — `check-duplicates`, `DuplicateChecker`, SQL: 0 дубликатов.
9. **Косметика:** `sender_*`/`receiver_*` убраны из `map/page.tsx`, `map/MapView.tsx`, `today/page.tsx`.
10. **Считывание в офисном `/reminders`** — секция «📥 Считывание тахографа и карт».
11. **Онбординг админа** — `admin-onboarding-actions.ts`, `AdminOnboardingCard.tsx`.

### 19.10.2026
12. **Фикс `/today`** — `phone_by, phone_pl` вместо `phone`.
13. **Поиск + фильтр статуса в `/driver`** — `searchParams.q` + `searchParams.status`.

### 20.10.2026 (день)
14. **Новая модель создания рейса** (груз первичен).
15. **SQL:** `trip_cargo` (паллеты, фрахт, таможня), `trip_segments` (contractor_*), `counters`, индексы.
16. **UI:** компактные фильтры, `SegmentForm` (таможня, подрядчик), `CargoForm` (паллеты, фрахт).
17. **DOCX для подрядчика** на польском.
18. **Оптимизация:** `prefetch={false}`, скелетоны, Speed Insights.

### 20.10.2026 (вечер — Фаза 6)
19. Мёртвый код (Фаза 6).
20. Поиск только по номеру рейса/заявки.
21. Logisat блокировка.
22. Прицеп в задании.
23. Массовый пересчёт координат.
24. Превью фото.
25. Merge tool клиентов.
26. Сторожевой бэкап.
27. Топливо и дата старта.
28. KPI водителей с прибылью.
29. Инцидент с секретами (перевыпущены).

### 21.10.2026 (день)
30. **DNS Supabase — закрыт** (опечатка `smodijsjwvsscfgloh` без `i`).
31. **Бэкап в Telegram — проверен.**
32. **Grep-аудит `.select()`** — найден баг `trips.route` в `task-actions.ts`.
33. **`task-actions.ts`** — фикс задания водителю (truck_reg/trailer_reg).
34. **`next.config.js`** — чистка.
35. **Merge tool подрядчиков (Фаза 8).**
36. **Фильтры `/reports` (Фаза 9).**
37. **Оптимизация и аудит (Фаза 10).**
38. **Миграция на Next.js 15 (Фаза 11).**

---

## 📈 Состояние скорости (21.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100** (до миграции).
- **После Next.js 15:** заметно быстрее (React 19 + улучшенный стриминг).
- **First Load JS shared:** 103 kB.
- **`/map`:** 105 kB (было 146 kB).
- **`/trips`:** 118 kB (было 204 kB).
- **`/reports`:** 114 kB (было 190 kB).
- **Регион Vercel:** `Washington, D.C. (iad1)`.

---

## ⏭️ Очередь задач (не срочно)
1. Обновить `eslint-config-next` до 15 (убрать warning `Invalid Options`).
2. `npm audit` — проверить остатки.
3. Отчёт «фрахт по грузам» (если нужно).
4. `optimizePackageImports` — добавить `react-leaflet` (опционально).

---

## 📊 Состояние данных (21.10.2026)
- `trips`: ~75, `trip_segments`: ~98, `trip_cargo`: ~78, `trip_expenses`: ~455.
- `driver_transactions`: наполняется.
- `counters`: сплошная нумерация.
- `audit_log`: ~471+.
- **Бэкапы:** `backup_2026-10-21_0731.json` — доставлен в Telegram ✅. Cron работает.

---

## 📋 Шпаргалка
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Тикет `SU-516613`:** ЗАКРЫТ (ложный, опечатка).
- **Vercel:** лимит Hobby (100/сутки) + GitHub Outage.
- **Скорость:** 94/100 (до), после Next.js 15 — быстрее.

**Закрыто:** Фазы 3.1–3.11, DNS Supabase, merge подрядчиков, фильтры `/reports`, чистка схемы, оптимизация бандлов, аудит пакетов, **миграция на Next.js 15 + React 19**.

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
