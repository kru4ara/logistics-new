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

---

## ⚠️ ПРАВИЛА РАБОТЫ С AI-АССИСТЕНТОМ (читать первым!)

### Контекст чата — не бесконечный
У ассистента ограниченное окно контекста (~200k токенов). Загрузка крупных файлов, бэкапов, полных HANDOVER'ов и логов **быстро съедает запас**. Когда контекст переполняется — ассистент теряет **начало** чата (HANDOVER, договорённости, ранние решения), а не конец. Это опасно: он начинает противоречить сам себе.

### Что НЕ надо загружать в чат
- **Бэкапы БД** (`backup_*.json`) — 200–300 KB мёртвого груза. Данные уже зафиксированы в HANDOVER.
- **Старые версии HANDOVER** — влиты в актуальный.
- **Файлы, которые уже заменены** — держим только актуальные версии.
- **Логи билдов целиком** — достаточно «билд зелёный» / «ошибка такая-то».
- **Огромные JSON/дампы** — если нужна конкретная выборка, лучше 2–3 строки, чем весь файл.

### Что стоит загружать в чат
- Только те файлы, которые **сейчас правим** (по одному, не пачкой).
- Актуальный HANDOVER — **один раз в начале нового чата**.
- Результат grep (список файлов, не содержимое).
- Скриншот ошибки (короткий).

### Сигналы ассистента о состоянии контекста
Ассистент обязан вставлять в ответы индикатор:

- 🟢 **Зелёный** — контекста много, работаем. Обычно не пишется.
- 🟡 **Жёлтый** — осталось ~30–40%. В конце ответа: «Пора подумать о точке сохранения».
- 🔴 **Красный** — осталось мало. **В начале** ответа: «Сейчас обновляем HANDOVER и начинаем новый чат».

### Когда сохраняться
**Не когда «уже поздно», а когда закрыт логический блок.**
- Пакет закрыт → обновили HANDOVER → **точка сохранения.**
- Закрыта фаза → обновили HANDOVER → **точка сохранения.**
- Не сохраняемся на середине файла.

### Как начинать новый чат
1. Первое сообщение — **полный HANDOVER** (один файл).
2. Второе сообщение — **что делаем прямо сейчас** (например: «Пакет C, файл `app/search/actions.ts`»).
3. Третье сообщение — **сам файл** целиком.
4. Дальше по одному файлу.

### Рабочий процесс
- **Полные файлы на замену, не куски**
- 1 шаг за раз, с проверкой
- **НЕ пишем код вслепую** — всегда запрашиваем актуальную версию файла перед заменой
- **Полные коды одним блоком** — без разбивки на секции (для удобства копирования)
- **Не переспрашивать «покажи файл X»** — если ассистент его уже видел в этом чате, используем то, что есть; если нужна свежая версия — просим.
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Server components → `createClient()` из `lib/supabase-server`
- **Внимательно с путями импортов:**
  - `app/X/page.tsx` → `../../lib/`, `../../components/`
  - `app/X/[id]/page.tsx` → `../../../lib/`, `../../../components/`
  - `app/X/[id]/edit/page.tsx` → `../../../../lib/`, `../../../components/`
  - `app/X/Y/page.tsx` (вложенная папка) → `../../../lib/`
  - **Компоненты в `app/components/`, `lib/` в корне проекта**

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
stops JSONB DEFAULT '[]'::jsonb,
price NUMERIC,
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
- **`lib/trip-renumber.ts`** — `renumberAllTrips()`
- **`lib/trip-task-text.ts`** — текст задания водителю (на сегментах; fallback на legacy-поля временный, до 3.6)

---

## 🔒 ЗАКРЫТЫЕ ФАЗЫ (история 3.1 → 3.5.7 + Пакеты A и B)

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
- Исправили `from_*` у 19 us-сегментов
- **DROP TABLE `trip_subcontractors`**
- Переписаны: `page.tsx` (карточка), `driver/page.tsx`, `today/page.tsx`, `contractors/page.tsx`, `contractors/[id]/page.tsx`, `driver/trips/[id]/page.tsx`, `reports/contractors/page.tsx`, `task-actions.ts`, `trip-task-text.ts`, `cron/backup`
- Удалены: `SubcontractorsBlock.tsx`, `SubcontractorForm.tsx`, `lib/trip-subcontractors.ts`, `app/api/trips/[id]/subcontractor/...`

### Фаза 3.5 — переход UI/логики на сегменты (14.10.2026)

**3.5.1 — убраны `sender2..5_*` из форм:**
- `app/trips/new/NewTripForm.tsx`, `app/trips/[id]/edit/EditTripForm.tsx`

**3.5.2 — убраны `sender2..5_*` из экшенов:**
- `app/geocode-actions.ts`, `app/trip-actions.tsx`

**3.5.3 — автосоздание сегмента при создании рейса:**
- `addTripWithAddress` создаёт us-сегмент (`position=1`) + «Основной груз»

**3.5.4 — route из сегментов в списке:**
- `app/trips/page.tsx`, `app/trips/DownloadButton.tsx`

**3.5.5 — route из сегментов в карточке:**
- `app/trips/[id]/page.tsx`

**3.5.6 — route/from/to из сегментов в export/map/today:**
- 🆕 `lib/trip-route.ts` — `buildRouteMap`
- `app/api/export/route.ts`, `app/map/page.tsx`, `app/today/page.tsx`

**3.5.7 — фикс `renumberAllTrips`:**
- Убран `.select('created_at')`, tiebreaker `id ASC`

**Пакет A — маршруты (закрыт 14.10):**
- `app/routes/page.tsx` — `buildRouteMap`, `DownloadButton` принимает `RouteCardData[]`
- `app/routes/DownloadButton.tsx` — `RouteCardData[]`, фикс `profit`
- `app/routes/export/page.tsx` — рефактор в card-стиль + `buildRouteMap`

**Пакет B — отчёты (закрыт 14.10):**
Из 7 файлов в HANDOVER-списке реально правились **2** (остальные 5 — чисты):
- `app/reports/page.tsx` — `buildRouteMap`, `ReportRow[]`
- `app/reports/DownloadButton.tsx` — `ReportRow[]` (типизация вместо `any[]`)
- 🆕 добавлен в Пакет B: `app/reports/DownloadButton.tsx` (его не было в исходном списке)
- **Чисты, не трогали:** `reports/contractors/page.tsx`, `reports/profitability/page.tsx`, `reports/excel/page.tsx`, `reports/excel/ExportForm.tsx`, `reports/logisat/page.tsx`, `reports/logisat/LogisatProblemsList.tsx`

---

## ⏭️ ОЧЕРЕДЬ ЗАДАЧ

### Пакет C — точечные проверки (grep 14.10.2026) — ✅ ЗАКРЫТ

**Grep по `app/driver app/search` дал 4 файла:**
- ✅ `app/search/actions.ts` — route из сегментов
- ✅ `app/driver/trips/[id]/page.tsx` — route из сегментов (один запрос вместо двух)
- ✅ `app/driver/trip-status-actions.ts` — route из сегментов для Telegram
- ✅ `app/driver/TripsList.tsx` — route/from/to из пропа `segmentsByTrip`
- ✅ `app/driver/page.tsx` — добавлен проп `segmentsByTrip` (buildRouteMap)
- ℹ️ `app/driver/stats/page.tsx` — чистый (grep не нашёл)

**Из старого списка Пакета C:** `app/driver/page.tsx` и `app/driver/stats/page.tsx` оказались чисты. Вместо них обнаружены и закрыты `trip-status-actions.ts` и `TripsList.tsx`.

### Фаза 3.6 — DROP COLUMN + чистка legacy (7 под-пакетов)

**3.6.1 — ✅ ЗАКРЫТ (5 файлов):**
- `app/api/trips/check-overlap/route.ts`
- `app/clients/[id]/page.tsx`
- `app/contractors/[id]/page.tsx`
- `app/drivers/[id]/page.tsx`
- `app/trucks/[id]/page.tsx`

**3.6.2 — ✅ ЗАКРЫТ (0 реально правились):**
- 🗑 `app/api/backfill-coordinates/route.ts` — **УДАЛЁН** (0 рейсов без координат)
- ✅ `app/map/page.tsx` — уже читает через buildRouteMap (Фаза 3.5.6)
- ✅ `app/map/MapView.tsx` — props, не БД
- ✅ `app/today/page.tsx` — уже через buildRouteMap

**3.6.3 — ✅ ЗАКРЫТ (5 файлов):**
- `app/trips/page.tsx` — buildRouteMap, поиск по сегментам
- `app/trips/TripsBulkList.tsx` — уже был чист (props)
- `app/trips/[id]/page.tsx` — buildRouteMap, fallback убран
- `app/driver/trips/[id]/page.tsx` — fallback убран
- `app/driver/trip-status-actions.ts` — fallback убран

**3.6.4 — `lib/trip-task-text.ts`** (112, 185, 190–215) — убрать fallback-блок. **← СЛЕДУЮЩИЙ**

**3.6.5 — формы + экшены (4 файла):**
- `app/geocode-actions.ts` (85–97, 188–200)
- `app/trip-actions.tsx` (164–176, 190, 220–227, 254–266, 292, 363)
- `app/trips/new/NewTripForm.tsx` (274–370)
- `app/trips/[id]/edit/EditTripForm.tsx` (48–59, 107, 110, 276–360)

**3.6.6 — 3 файла из GitHub Search:**
- `app/trips/DownloadButton.tsx:17`
- `app/reports/DownloadButton.tsx:34`
- `app/reports/page.tsx:270,273,351`

**3.6.7 — SQL `DROP COLUMN` (необратимо) + финальный grep.**

**Ложные срабатывания (НЕ трогать):** локальные псевдонимы `sender_*` / `receiver_*` из `buildRouteMap` в `map/page.tsx`, `today/page.tsx`. `map/MapView.tsx` — только типы/рендер, БД не читает.

**Инциденты этого чата (уроки):**
- Заливка связанных файлов **одним коммитом** (иначе билд падает на type-check — было с `page.tsx` + `TripsList.tsx`).
- **`buildRouteMap` принимает `SegmentRouteRow[]` — поле `trip_id` обязательно.** Подавать `(segmentsRaw || [])`, а не смапленный `segments`.
- **При добавлении импорта не удалять существующие** (было: пропал `buildDriverTaskText`).

## ⚠️ Рабочий процесс с кодом

Проект ведётся в GitHub (правки через веб/инструмент с автокоммитом). Локальный клон в `~/projects/logistics-new` **отстаёт** от origin.

**grep/поиск:**
- **GitHub Code Search** (в браузере): `https://github.com/kru4ara/logistics-new/search?q=ТЕРМИН&type=code`
- **Или** локально, но сначала `git pull`.

**Заливка связанных файлов:** одним коммитом, если меняется интерфейс между ними (иначе билд Vercel упадёт на type-check — как было с `page.tsx` + `TripsList.tsx`).

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
- Нормализация `trip_number` через БД-триггер при INSERT (MAX+1)
- Добавить `created_at` в `trips` — для аудита и «последние созданные»
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

### Дашборд «Сегодня» (`/today`)
- **`app/today/page.tsx`** — оперативный экран: KPI (Загрузок / Выгрузок / В пути / Требует внимания), события из рейсов, сегментов, экспедирования
- **Sidebar** — пункт «Сегодня» (только admin)

### Отчёт «Ошибки Logisat» (`/reports/logisat`)
- 4 категории проблем (активные/устаревшие/одометр/топливо) + архив
- `LogisatProblemsList.tsx` — аккордеон + bulk-синк
- `app/api/logisat/sync-bulk/route.ts`

### Онбординг водителя
- `drivers.onboarded_at`
- `app/driver/onboarding-actions.ts`, `app/driver/OnboardingCard.tsx`
- Рендерится в `app/driver/page.tsx` если `onboarded_at IS NULL`

### Bulk-операции в рейсах
- `app/trips/bulk-actions.ts` — `bulkSetStatus`, `bulkDelete`
- `app/trips/TripsBulkList.tsx` — чекбоксы, sticky-toolbar

### CSV-экспорт
- `app/api/export/route.ts` — `?format=csv`, `\uFEFF` BOM, `;` разделитель
- `app/reports/excel/ExportForm.tsx` — переключатель xlsx/csv

### Проверка пересечений рейсов
- `app/trips/[id]/edit/OverlapWarning.tsx`
- `app/api/trips/check-overlap/route.ts`

---

## ✨ ЧТО СДЕЛАНО РАНЕЕ (до 09.10)

### Редизайн (закрыт полностью)
- Главная, пачки 2-5, большие страницы, логин, empty states, loading-скелетоны, водительский раздел

### Фиксы и улучшения
- Sidebar (дубли, «Сегодня», `isAdmin`-гейт)
- `trucks/page.tsx` — единый empty state
- `reports/page.tsx` — 4 карточки-ссылки
- `statistics/page.tsx` — emoji → lucide, `blue-*` → `brand-*`
- `forwarding/page.tsx` — годы из данных
- `forwarding/actions.ts` — фикс `renumberAllOrders`
- `statistics/page.tsx`, `driver/reminders/page.tsx` — поля документов прицепа
- `driver/stats/page.tsx` — фикс склейки

### Telegram-уведомления
- Водителю лично — только при создании рейса
- В офисный чат — при `active` / `completed`
- Не отправляется при `invoiced` / `paid` / `planned`

### Заявки экспедирования — перенумерация
- Номера `1..N` по `load_date ASC`, `created_at ASC`

### Cron
- `/api/update-rates` — `0 6 * * *`
- `/api/cron/reminders` — `0 9 * * *`
- `/api/cron/backup` — `0 7 * * *`

---

## Что работает

### Авторизация
- Login через server action + `bcrypt.compare` + httpOnly cookie
- Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx`
- RLS включён, публичные политики удалены

### Домены
- **Рейсы** (`trips` + `trip_segments` + `trip_cargo` + `trip_segment_cargo` + `trip_expenses` + `trip_documents`)
- **Экспедирование** (`forwarding_orders` + `forwarding_contractors` + `forwarding_points` + `forwarding_expenses`)
- Клиенты, водители, тягачи, локации, подрядчики
- Напоминания + cron рассылки в Telegram
- Logisat: синхронизация, bulk-синк
- Курсы валют, документы
- **Бэкапы**: 17 таблиц (без `trip_subcontractors`)

### Комбинированные перевозки
- Клиент платит за весь рейс; подрядчик везёт A→C; мы едем C→Б
- **`trip_segments`** — `executor_type='us'` / `'contractor'`
- У сегмента: `stops` JSONB, `price` (подрядчику), `currency`
- **DOCX подрядчику** — ZLECENIE TRANSPORTOWE
- **DOCX водителю** — «Задание водителю»
- **Telegram водителю** — `SendSegmentTaskButton`

---

## Подводные камни

### PostgREST и FK
У `trips` два FK на `trucks`: `truck_id`, `trailer_id`. Алиасы обязательны:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
```

### `trips.route`, `sender_*`, `receiver_*` — legacy
- В БД пока **есть** (DROP в Фазе 3.6)
- Код читает их **только** через fallback в `lib/trip-task-text.ts` (временный)
- `geocode-actions.ts` / `trip-actions.tsx` продолжают **писать**, но не читают
- Все страницы (`/trips`, `/routes`, `/map`, `/today`, `/api/export`, `/reports`) читают из `trip_segments`

### Supabase SQL: ошибка 42P10
`UPDATE ... FROM LATERAL` — нельзя ссылаться на таблицу-цель в LATERAL. Решение — CTE.

### renumberAllTrips (3.5.7)
- Раньше падал: `.select('...created_at')` — колонки нет. Фикс: убрать, tiebreaker `id ASC`.
- Вызовы — 2: `addTripWithAddress`, `updateTrip`.

### Ошибки типов при переписывании
- `SubcontractorForm.tsx`, `StopDb`, `TextOpts.italics`, `numberBase`, `stop: StopDb`, `computedRoute` — все пофикшены

### Таймауты Vercel-билдов
Static page generation (60s timeout). Лечится: Redeploy без кэша или ретрай.

### Автокоммит
Каждое изменение файла = коммит + билд. 5 правок = 5 билдов. Жрёт квоту Vercel.

---

## 📋 Шпаргалка по текущему состоянию (14.10.2026, поздний вечер)

- `trips`: 71, `trip_segments`: 94, `trip_cargo`: 74, `trip_segment_cargo`: 79, `trip_expenses`: ~416
- `trip_subcontractors`: DROP
- `trips.sender_*`, `trips.receiver_*`, `trips.route`: **ЕЩЁ ЕСТЬ** (DROP в 3.6.7)

**Закрыто:** Фазы 3.1–3.5.7 + Пакеты A, B, C + Фазы 3.6.1, 3.6.2, 3.6.3

**В очереди:**
- 3.6.4 — `lib/trip-task-text.ts`
- 3.6.5 — формы + экшены (4 файла)
- 3.6.6 — 3 мелких файла
- 3.6.7 — SQL DROP + финальный grep

**Следующий шаг:** 3.6.4, файл `lib/trip-task-text.ts`.

---

## 🆕 Условие работы с AI-ассистентом (с 14.10.2026)

**При старте нового чата:**
1. Первое сообщение — **полный HANDOVER** (этот файл), один раз.
2. Второе — **что делаем сейчас** («Пакет C, файл `app/search/actions.ts`»).
3. Третье — **сам файл**, целиком.
4. Дальше — по одному файлу.

**Ассистент обязан предупреждать о контексте:**
- 🟡 — «осталось ~30–40%, пора подумать о сохранении» (в конце ответа)
- 🔴 — «осталось мало, **сейчас** обновляем HANDOVER и новый чат» (в начале ответа)

**Сохраняемся на границах блоков**, не на середине файла:
- Пакет закрыт → обновили HANDOVER → новый чат.
- Фаза закрыта → обновили HANDOVER → новый чат.

**Не загружаем в чат:**
- Бэкапы БД
- Старые HANDOVER
- Уже заменённые файлы
- Логи билдов целиком
- Огромные JSON/дампы

**Загружаем:**
- Актуальный HANDOVER (один раз в начале)
- Только те файлы, что правим прямо сейчас
- Результат grep (список, не содержимое)
- Скриншоты ошибок (короткие)

**Цель:** сохранить непрерывность работы через серию коротких чатов, каждый из которых стартует с полного HANDOVER. Это надёжнее, чем один длинный чат, который в какой-то момент теряет начало.
