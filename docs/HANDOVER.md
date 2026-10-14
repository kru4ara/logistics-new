# HANDOVER — Logistics CRM (14.10.2026)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: kru4ara/logistics-new (master) — автокоммит на каждое изменение файла
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: smodijsjwcvsscfgloh
- Vercel project: kru4aras-projects/logistics-new

## ENV (Vercel → Settings → Environment Variables)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY — для клиента, RLS закрыт
- SUPABASE_SERVICE_ROLE_KEY — server client, обходит RLS
- LOGISAT_SERVER / LOGISAT_USERNAME / LOGISAT_PASSWORD
- TELEGRAM_BOT_TOKEN — токен @raibuilding_bot
- TELEGRAM_CHAT_ID — общий чат офиса
- TELEGRAM_WEBHOOK_SECRET — секрет для webhook
- CRON_SECRET — секрет для cron

**Vercel Secret-переменные не редактируются** — только удалить + создать заново + Redeploy.

## Правила работы
- **Полные файлы на замену, не куски**
- 1 шаг за раз, с проверкой
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Server components → `createClient()` из `lib/supabase-server`
- **Внимательно с путями импортов:**
  - `app/X/page.tsx` → `../../lib/`, `../../components/`
  - `app/X/[id]/page.tsx` → `../../../lib/`, `../../../components/`
  - `app/X/[id]/edit/page.tsx` → `../../../../lib/`, `../../../components/`
  - `app/X/Y/page.tsx` (вложенная папка) → `../../../lib/`
  - **Компоненты в `app/components/`, `lib/` в корне проекта**
- **НЕ пишу код вслепую** — всегда запрашивать актуальную версию файла перед заменой
- **Полные коды одним блоком** — без разбивки на секции (для удобства копирования)

---

## 🎨 ДИЗАЙН-СИСТЕМА

### Палитра (`tailwind.config.js`)
- **`brand`** — индиго/фиолет (заменил `blue-600`): `bg-brand-600`, `text-brand-600`, `hover:bg-brand-700`
- **`accent`** — фиолетовый (для градиентов с `brand`)
- **`ink`** — тёмный (для sidebar, `bg-ink-900` = `#0f172a`)
- **`rounded-3xl`** переопределён на `1.25rem` (20px вместо дефолтных 24px)

### Тени
- `shadow-brand-sm`, `shadow-brand`, `shadow-brand-lg` — индиго
- `shadow-soft`, `shadow-soft-lg` — мягкие серые

### Анимации
- `animate-fade-in` (200ms)
- `animate-slide-up` (250ms) — карточки/секции
- `animate-slide-down` (200ms) — Toaster, sticky-toolbar
- `animate-scale-in` (150ms) — модалки
- `animate-shimmer` (2s linear)

### Утилитарные классы (`app/globals.css`)
- `.card` — `bg-white rounded-2xl border border-slate-100 shadow-soft`
- `.card-hover` — подъём при hover
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- `.input` — с `focus:ring-brand-500` и **`text-base`** (критично для iOS — иначе Safari зумит при фокусе)
- `.badge`, `.skeleton`, `.scrollbar-thin`

### Иконки
- **Lucide-react** (`^0.460.0`), используется во всём UI
- Emoji остались только в `<option>` нативных select, логах/Telegram-сообщениях, `CATEGORY_META` (для donut)

### Компоненты shadcn (`components/ui/`)
- `button.tsx`, `card.tsx`, `input.tsx`, `table.tsx` — мержат классы через `cn()`

---

## 📁 СТРУКТУРА ПРОЕКТА

### Гибкая модель рейсов (грузы + сегменты) — АКТИВНА

**Таблицы БД:**

```sql
-- trip_cargo: грузы на рейсе
id UUID PRIMARY KEY,
trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
position INT NOT NULL,
label TEXT,
cargo_type TEXT,
weight_kg NUMERIC,
client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
notes TEXT,
from_country/from_city/from_company/from_address/from_postal_code TEXT,
to_country/to_city/to_company/to_address/to_postal_code TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()

-- trip_segments: участки рейса
id UUID PRIMARY KEY,
trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
position INT NOT NULL,
executor_type TEXT NOT NULL,             -- 'us' | 'contractor'
contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
date_from DATE, date_to DATE,
from_country/from_city/from_company/from_address/from_postal_code TEXT,
to_country/to_city/to_company/to_address/to_postal_code TEXT,
stops JSONB DEFAULT '[]'::jsonb,          -- [{type:'load'|'reload'|'unload', company, country, city, address, postal_code, date}]
price NUMERIC,                            -- стоимость подрядчику
currency TEXT DEFAULT 'EUR',
notes TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()

-- trip_segment_cargo: связь сегмент ↔ грузы
segment_id UUID REFERENCES trip_segments(id) ON DELETE CASCADE,
cargo_id UUID REFERENCES trip_cargo(id) ON DELETE CASCADE,
PRIMARY KEY (segment_id, cargo_id)

-- trip_expenses.segment_id — FK на trip_segments (ON DELETE SET NULL)
```

**Старые таблицы:**
- `trip_subcontractors` — **DROP** (Фаза 3.3, 14.10.2026). Всё переехало в `trip_segments` с `executor_type='contractor'`.

**Хелперы:**
- **`lib/trip-route.ts`** — `buildRouteMap(segments): Map<tripId, TripRouteInfo>`
  - `TripRouteInfo = { route, from_city, from_country, to_city, to_country }`
  - `SegmentRouteRow = { trip_id, position, from_city, from_country, to_city, to_country }`
  - Используется во всех местах, где раньше был `trips.route`
- **`lib/trip-renumber.ts`** — `renumberAllTrips()` (после 3.5.7 — убран `.select('created_at')`, tiebreaker `id ASC`)
- **`lib/trip-task-text.ts`** — текст задания водителю (на сегментах; fallback на legacy-поля временный, до 3.6)

---

## 🔒 ЗАКРЫТЫЕ ФАЗЫ (история 3.1 → 3.5.7)

### Фаза 3.1 — удалён `/trips-test` (13.10.2026)
- Все тестовые файлы удалены
- **Wand2** («Подставить из груза») перенесён в prod: `app/trips/[id]/SegmentForm.tsx`
- Sidebar очищен

### Фаза 3.2 — уведомления / DOCX для 'us'-сегментов (13.10.2026)
- **`SendSegmentTaskButton`** — отправка Telegram-задания водителю одного 'us'-сегмента
- **`SegmentDriverDocxButton`** + `app/api/trips/[id]/segment/[segId]/driver-docx/route.ts` — печатная форма «Задание водителю»
- **`sendSegmentTaskToDriver`** в `task-actions.ts`
- **Подрядчикам ничего не отправляем** — только водителям наших сегментов

### Фаза 3.3 — legacy cleanup (14.10.2026)
- Мигрировали 68 рейсов без сегментов → один 'us'-сегмент + виртуальный груз «Основной груз»
- Мигрировали 19 записей `trip_subcontractors` → `trip_segments` типа `contractor` + привязали расходы
- Нормализовали `position` — 1, 2, 3... без дыр (ROW_NUMBER по `start_date ASC NULLS LAST, id ASC`)
- Исправили `from_*` у 19 us-сегментов: было «страна загрузки → Брест», стало «Siedlce / KAMEX → Брест» (взято из `to_*` предыдущего contractor-сегмента)
- **DROP TABLE `trip_subcontractors`**
- Переписаны: `page.tsx` (карточка), `driver/page.tsx`, `today/page.tsx`, `contractors/page.tsx`, `contractors/[id]/page.tsx`, `driver/trips/[id]/page.tsx`, `reports/contractors/page.tsx`, `task-actions.ts`, `trip-task-text.ts`, `cron/backup`
- Удалены: `SubcontractorsBlock.tsx`, `SubcontractorForm.tsx`, `lib/trip-subcontractors.ts`, `app/api/trips/[id]/subcontractor/...`

### Фаза 3.5 — переход UI/логики на сегменты (14.10.2026)
**3.5.1 — убраны `sender2..5_*` из форм:**
- `app/trips/new/NewTripForm.tsx` — убран блок доп. точек погрузки
- `app/trips/[id]/edit/EditTripForm.tsx` — убраны доп. точки + поля `sender2..5_*` из типа `Trip`

**3.5.2 — убраны `sender2..5_*` из экшенов:**
- `app/geocode-actions.ts` — `addTripWithAddress` без legacy-полей
- `app/trip-actions.tsx` — `updateTrip` без legacy-полей

**3.5.3 — автосоздание сегмента при создании рейса:**
- `addTripWithAddress` теперь создаёт us-сегмент (`position=1`) + «Основной груз» + связь
- Ошибки при создании сегмента не роняют создание рейса

**3.5.4 — route из сегментов в списке:**
- `app/trips/page.tsx` — параллельный запрос `trip_segments`, route через `buildRouteFromSegments` (inline → потом вынесено в `lib/trip-route.ts`)
- `app/trips/DownloadButton.tsx` — принимает `TripCardData[]`, фикс бага `expenses = 0`

**3.5.5 — route из сегментов в карточке:**
- `app/trips/[id]/page.tsx` — `buildRouteFromSegments` + `computedRoute`
- `app/trips/DownloadButton.tsx` — читает готовые `TripCardData`

**3.5.6 — route/from/to из сегментов в export/map/today:**
- 🆕 `lib/trip-route.ts` — хелпер `buildRouteMap`
- `app/api/export/route.ts` — route в Excel из сегментов
- `app/map/page.tsx` — route/from/to из сегментов для попапов
- `app/today/page.tsx` — route/from/to из сегментов для блоков загрузок/выгрузок
- `app/map/MapView.tsx` — НЕ трогали (props interface тот же)

**3.5.7 — фикс `renumberAllTrips`:**
- `lib/trip-renumber.ts` — убран `.select('created_at')` (колонки нет в `trips`), tiebreaker переключён на `id ASC`
- Разовая SQL-перенумерация всех рейсов через `ROW_NUMBER()`

**Пакет A — маршруты (закрыт 14.10):**
- `app/routes/page.tsx` — `buildRouteMap` из сегментов, `DownloadButton` принимает `RouteCardData[]`
- `app/routes/DownloadButton.tsx` — `RouteCardData[]`, фикс `profit`, тот же вид, что `/trips`
- `app/routes/export/page.tsx` — рефактор в card-стиль + `buildRouteMap`, `Link`/`lucide` вместо inline-styles

---

## ⏭️ ОЧЕРЕДЬ ЗАДАЧ

### Остаток Фазы 3.5

**Пакет B — отчёты (7 файлов):**
- `app/reports/page.tsx`
- `app/reports/contractors/page.tsx` — уже почищен в 3.3
- `app/reports/profitability/page.tsx`
- `app/reports/excel/page.tsx`
- `app/reports/excel/ExportForm.tsx`
- `app/reports/logisat/page.tsx`
- `app/reports/logisat/LogisatProblemsList.tsx`

**Пакет C — точечные проверки:**
- `app/driver/stats/page.tsx`
- `app/search/actions.ts`
- `app/driver/trips/[id]/page.tsx` — проверка после 3.3
- `app/driver/page.tsx` — проверка после 3.3

### Фаза 3.6 — DROP COLUMN (необратимо)

**Перед запуском:**
1. `grep -rn "sender_\|receiver_\|\.route" app lib --include="*.ts" --include="*.tsx"`
2. Убедиться, что остались только:
   - fallback в `lib/trip-task-text.ts` (временный)
   - `app/geocode-actions.ts` / `app/trip-actions.tsx` (пишут в БД, но читать перестанут)

**SQL:**
```sql
ALTER TABLE trips DROP COLUMN sender_country, sender_city, sender_name, sender_address,
                          sender_postal_code, sender_loading_number,
                          sender2_country, sender2_name, sender2_postal_code, sender2_city,
                          sender2_address, sender2_loading_number,
                          sender3_country, sender3_name, sender3_postal_code, sender3_city,
                          sender3_address, sender3_loading_number,
                          sender4_country, sender4_name, sender4_postal_code, sender4_city,
                          sender4_address, sender4_loading_number,
                          sender5_country, sender5_name, sender5_postal_code, sender5_city,
                          sender5_address, sender5_loading_number,
                          receiver_country, receiver_city, receiver_name, receiver_address,
                          receiver_postal_code, receiver_loading_number,
                          route;
```

**После DROP:**
- Убрать fallback из `lib/trip-task-text.ts` (оставить только сегменты)
- Очистить `addTripWithAddress` и `updateTrip` от записи `sender_*`/`receiver_*`/`route`
- Убрать поля из форм `/trips/new` и `/trips/[id]/edit` (отправитель/получатель)
- Заодно можно убрать геокодирование через Nominatim

### Идеи (не срочно)
- Нормализация `trip_number` — сделать через БД-триггер при INSERT (MAX+1), чтобы не полагаться на `renumberAllTrips`
- Добавить `created_at` в `trips` — полезно для аудита и «последние созданные»
- Печатные формы (отчёт по рейсам)
- Онбординг админа
- Дубликаты клиентов/подрядчиков

---

## 📊 СОСТОЯНИЕ ДАННЫХ (14.10.2026)

- `trips`: 71
- `trip_segments`: 94 (71 us + 23 contractor)
- `trip_cargo`: 74
- `trip_segment_cargo`: 79
- `trip_expenses`: ~416 (22 contractor привязаны через `segment_id`)
- `trip_subcontractors`: **DROP**

**Бэкапы:**
- `backup_2026-10-13_0730.json` — до начала Фазы 3
- `backup_2026-10-14_0607.json` — перед миграцией 3.3.3a
- `backup_2026-10-14_0730.json` — утренний (в нём `trip_subcontractors` ещё есть — снят до DROP)

---

## 📁 СТРУКТУРА ПРОЕКТА (карта)

### Гибкая модель рейсов — АКТИВНА
См. секцию выше «СТРУКТУРА ПРОЕКТА → Гибкая модель рейсов».

### Дашборд «Сегодня» (`/today`)
- **`app/today/page.tsx`** — оперативный экран:
  - KPI: Загрузок / Выгрузок / В пути / Требует внимания
  - Секции: «Загрузки сегодня» (зелёные), «Выгрузки сегодня» (красные), «В пути сейчас», «Требует внимания»
  - События из: рейсов (`start_date`/`end_date` = сегодня), сегментов (`stops` = сегодня), экспедирования (`forwarding_points.date` = сегодня)
  - Ссылка на каждое событие → карточка рейса / заявки
- **Sidebar** — пункт «Сегодня» под «Главная» (только admin)

### Отчёт «Ошибки Logisat» (`/reports/logisat`)
- **`app/reports/logisat/page.tsx`** — 4 категории проблем:
  - 🔴 «Активные — синк не выполнялся» (`status='active'`, `logisat_synced_at IS NULL`)
  - 🟡 «Синк устарел» (active + синк >7 дней)
  - 🟠 «Одометр не передаёт данные»
  - 🔴 «Топливо не передаёт данные»
  - ⚪ «Архив — синк не выполнялся» (completed/invoiced/paid) — **свёрнут по умолчанию**
  - Плюс «Тягачи без Logisat» (не настроен `deviceId` / выключен)
- **`app/reports/logisat/LogisatProblemsList.tsx`** — клиентский:
  - Аккордеон (свернуть/развернуть)
  - «Показать все (N)» — первые 9 карточек, дальше по клику
  - **Кнопка «Синкать все (N)»** на активных секциях → bulk-синк
  - Inline-статус: «Готово: X из Y» / «X успешно, Y с ошибкой»
- **`app/api/logisat/sync-bulk/route.ts`** — POST `{ tripIds }`, батчи по 3 параллельно
- **`app/reports/page.tsx`** — 4-я карточка «Ошибки Logisat» (оранжевый градиент)

### Онбординг водителя
- SQL: `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ DEFAULT NULL;`
- **`app/driver/onboarding-actions.ts`** — `markDriverOnboarded()`
- **`app/driver/OnboardingCard.tsx`** — приветственная карточка с 4 шагами:
  1. «Начни рейс» → кнопка `Начать рейс`
  2. «Заверши рейс» → указать дату финиша
  3. «Загрузи CMR» → фото документа
  4. «Следи за сроками» → раздел Напоминания
  - Кнопка «Всё понял, поехали» → ставит `onboarded_at`, скрывает карточку
- **`app/driver/page.tsx`** — рендерит `<OnboardingCard>` между приветствием и активными рейсами, если `onboarded_at IS NULL`

### Bulk-операции в рейсах
- **`app/trips/bulk-actions.ts`** — `bulkSetStatus`, `bulkDelete`
  - Массовая смена статуса (запрещён `completed` — требует `end_date`)
  - Массовое удаление
  - Audit-лог для каждого рейса отдельно
- **`app/trips/TripsBulkList.tsx`** — клиентский:
  - Чекбоксы на карточках
  - Клик по остальной площади → открытие рейса
  - Sticky-toolbar сверху при выборе: «Выбрано: N», «Выбрать все», «Статус ▾», «Удалить»
- **`app/trips/page.tsx`** — рендерит `<TripsBulkList>`

### CSV-экспорт
- **`app/api/export/route.ts`** — параметр `?format=csv`:
  - `XLSX.utils.sheet_to_csv(sheet, { FS: ';' })` — разделитель `;` для русской локали Excel
  - `\uFEFF` BOM в начале — корректная кириллица
  - Файл `.csv` вместо `.xlsx`
- **`app/reports/excel/ExportForm.tsx`** — переключатель «Excel (.xlsx) / CSV (.csv)»

### Проверка пересечений рейсов
- **`app/trips/[id]/edit/OverlapWarning.tsx`** — клиентский:
  - При выборе тягача и дат — проверка через `/api/trips/check-overlap` (GET `truckId`, `startDate`, `endDate`, `excludeTripId`)
  - Предупреждение (не блокирующее) с указанием конфликтующего рейса, клиента, маршрута, дат
  - Ссылка «Открыть конфликтующий рейс →»
- **`app/api/trips/check-overlap/route.ts`** — GET, возвращает конфликты
- **`app/trips/[id]/edit/page.tsx`** — подключён `<OverlapWarning>` рядом с полем «Тягач»
- ⚠️ Если фичу надо отключить — удалить `<OverlapWarning>` из edit-page

---

## ✨ ЧТО СДЕЛАНО РАНЕЕ (до 09.10)

### Редизайн (закрыт полностью)
- Главная (`app/page.tsx`) — компактная: приветствие, KPI месяц, «Требует внимания», «За всё время» (5 карточек), график 12 мес, донат расходов. **Убрано:** Топ-5 клиентов/маршрутов, Последние рейсы/экспедиции
- Пачки 2-5: кнопки, медиа, крупные компоненты, misc — brand-палитра + lucide
- Большие страницы: `forwarding/[id]`, `clients/[id]`, `reports/profitability`, `map/MapView`, `driver/reminders`
- Логин (`app/login/page.tsx`) — брендинг RAIBUILDING, `brand-800` в градиенте
- Empty states: `/reports/profitability`, `/map/MapView`
- Loading-скелетоны: `app/loading.tsx`, `app/trips/loading.tsx`, `app/forwarding/loading.tsx`, `app/drivers/loading.tsx`, `app/trucks/loading.tsx`, `app/clients/loading.tsx`, `app/contractors/loading.tsx`, `app/locations/loading.tsx`, `app/reminders/loading.tsx`, `app/reports/loading.tsx`, `app/trips/[id]/loading.tsx`, `app/forwarding/[id]/loading.tsx`, `app/clients/[id]/loading.tsx`
- Водительский раздел: `app/driver/page.tsx`, `app/driver/TripsList.tsx`, `app/driver/trips/[id]/page.tsx`, `app/driver/stats/page.tsx`

### Фиксы и улучшения
- **Sidebar** — устранены дубли у водителя, добавлены «Сегодня» и `isAdmin`-гейт для «Главная»
- **`app/trucks/page.tsx`** — единый empty state (одна большая карточка, если пусто; иначе секции тягачи/прицепы)
- **`app/reports/page.tsx`** — 4 карточки-ссылки (Прибыльность, Ошибки Logisat, Экспорт, Подрядчики)
- **`app/statistics/page.tsx`** — emoji → lucide, `blue-*` → `brand-*`
- **`app/forwarding/page.tsx`** — годы фильтра из данных
- **`app/forwarding/actions.ts`** — фикс `renumberAllOrders`: обновляем всех, двухфазная схема, проверки
- **`app/statistics/page.tsx`**, `app/driver/reminders/page.tsx` — исправлены поля документов прицепа (`customs_certificate_expiry`)
- **`app/driver/stats/page.tsx`** — фикс склейки файла

### Telegram-уведомления (`app/driver/trip-status-actions.ts`)
- **Водителю лично** — только при **создании** нового рейса (`notifyDriverAboutNewTrip` в `geocode-actions.ts`)
- **В офисный чат** — при `active` («🚛 Рейс №N · Начат») и `completed` («✅ Рейс №N · Завершён»)
- **Не отправляется** при `invoiced` / `paid` / `planned`
- Хелперы `pickOne` / `pickName` для relations

### Заявки экспедирования — перенумерация
- Номера всегда `1..N` по `load_date ASC`, `created_at ASC`
- Вызывается при create / update / delete
- Существующие данные выровнены SQL

### Cron
- `/api/update-rates` — `0 6 * * *` — курсы PLN/BYN
- `/api/cron/reminders` — `0 9 * * *` — рассылка напоминаний
- `/api/cron/backup` — `0 7 * * *` — дамп 18 таблиц (10:00 Минск)

---

## Что работает

### Авторизация
- Login через server action + `bcrypt.compare` + httpOnly cookie
- Logout через server action
- Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx` (клиентский)
- RLS включён, публичные политики удалены

### Домены
- **Рейсы** (`trips` + `trip_segments` + `trip_cargo` + `trip_segment_cargo` + `trip_expenses` + `trip_documents`)
- **Экспедирование** (`forwarding_orders` + `forwarding_contractors` + `forwarding_points` + `forwarding_expenses`)
- Клиенты, водители, тягачи, локации, подрядчики
- Напоминания + cron рассылки в Telegram
- Logisat: синхронизация рейса, просмотр расхода `/driver/logisat`, bulk-синк
- Курсы валют
- Документы
- **Бэкапы**: 17 таблиц (без `trip_subcontractors`)

### Комбинированные перевозки
- Схема: клиент платит за весь рейс; подрядчик везёт A→C; мы едем C→Б
- **`trip_segments`** — `executor_type='us'` (наши) или `executor_type='contractor'` (подрядчик)
- У сегмента: `stops` JSONB (load/reload/unload), `price` (подрядчику), `currency`
- **DOCX подрядчику** — ZLECENIE TRANSPORTOWE с N точками A + C (для contractor-сегмента)
- **DOCX водителю** — «Задание водителю» (для us-сегмента)
- **Telegram водителю** — `SendSegmentTaskButton` на us-сегменте

---

## Подводные камни

### PostgREST и FK
У `trips` два FK на `trucks`: `truck_id` и `trailer_id`. Алиасы обязательны:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
```

### `trips.route`, `sender_*`, `receiver_*` — legacy
- В БД пока **есть** (DROP в Фазе 3.6)
- Код читает их **только** через fallback в `lib/trip-task-text.ts` (временный)
- `geocode-actions.ts` / `trip-actions.tsx` продолжают **писать**, но не читают
- Все страницы (`/trips`, `/routes`, `/map`, `/today`, `/api/export`) читают из `trip_segments` через `buildRouteMap`

### Supabase SQL: ошибка 42P10
`UPDATE ... FROM LATERAL (... us.trip_id ...)` — нельзя ссылаться на таблицу-цель в LATERAL. Решение — обернуть в CTE. Пример в миграции 3.3.3a.

### renumberAllTrips (3.5.7)
- Раньше падал всегда: `.select('id, trip_number, start_date, created_at')` — колонки `created_at` в `trips` нет. Supabase возвращал error, функция логировала и выходила без изменений. Триггерилось при создании новых рейсов (`trip_number = 0`). Фикс: убрать `created_at`, tiebreaker на `id ASC`.
- Вызовы — 2: `addTripWithAddress`, `updateTrip`.

### Ошибки типов при переписывании
- `SubcontractorForm.tsx` ломал сборку, пока был жив — удалён
- `StopDb` не экспортился из `driver-docx/route.ts` — правили локально
- `TextOpts.italics` не был в типе `txt()` — добавили
- `numberBase` потерялся при патче `contractors/[id]/page.tsx` — восстановили
- `stop: StopDb` без аннотации в `driver/trips/[id]/page.tsx` — добавили
- `computedRoute` не был объявлен в `trips/[id]/page.tsx` — добавили функцию + переменную

### Таймауты Vercel-билдов
Периодически падает Static page generation (60s timeout). Лечится:
1. Redeploy без кэша — Vercel → Deployments → последний красный → ⋯ → Redeploy → снять галку «Use existing build cache»
2. Ретрай — иногда достаточно просто пересобрать

### Автокоммит
Каждое изменение файла = отдельный коммит + отдельный билд. Если делаешь 5 правок, получишь 5 билдов. Иногда полезно, иногда жрёт квоту Vercel.

---

## 📋 Шпаргалка по текущему состоянию (на момент 14.10.2026, вечер)

- `trips`: 71
- `trip_segments`: 94 (71 us + 23 contractor)
- `trip_cargo`: 74
- `trip_segment_cargo`: 79
- `trip_expenses`: ~416
- `trip_subcontractors`: DROP

**Закрыто:** Фазы 3.1–3.5.7 + Пакет A (routes)
**В очереди:** Пакет B (отчёты), Пакет C (точечные), Фаза 3.6 (DROP COLUMN)
