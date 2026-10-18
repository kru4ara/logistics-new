# HANDOVER — Logistics CRM (15.10.2026)

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
2. Второе сообщение — **что делаем прямо сейчас**.
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

### ⚠️ Правки через GitHub Web UI (после 14.10.2026)

**Правки делаются через GitHub Web UI** (карандаш → выделить всё → вставить → Commit).
Локальный клон в `~/projects/logistics-new` **отстаёт** — перед grep делать `git pull`.

**grep через GitHub Search:**
`https://github.com/kru4ara/logistics-new/search?q=ТЕРМИН&type=code`

**Связанные файлы — один коммит** (иначе Vercel падает на type-check между пушами). Если правишь пару файлов (форма + экшен) — заливать **вместе**, не по очереди.

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
- `animate-fade-in` (200ms), `animate-slide-up` (250ms), `animate-slide-down` (200ms), `animate-scale-in` (150ms), `animate-shimmer` (2s linear)

### Утилитарные классы (`app/globals.css`)
- `.card`, `.card-hover`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.input`, `.badge`, `.skeleton`, `.scrollbar-thin`
- `.input` — с `focus:ring-brand-500` и **`text-base`** (критично для iOS)

### Иконки
- **Lucide-react** (`^0.460.0`), используется во всём UI
- Emoji остались только в `<option>` нативных select, логах/Telegram-сообщениях, `CATEGORY_META`

### Компоненты shadcn (`components/ui/`)
- `button.tsx`, `card.tsx`, `input.tsx`, `table.tsx` — мержат классы через `cn()`

---

## 📁 СТРУКТУРА ПРОЕКТА

### Гибкая модель рейсов (грузы + сегменты) — АКТИВНА

**Таблицы БД:**

```sql
-- trip_cargo: грузы на рейсе
id UUID, trip_id, position INT, label TEXT, cargo_type TEXT, weight_kg NUMERIC,
client_id UUID REFERENCES clients, notes TEXT,
from_country/from_city/from_company/from_address/from_postal_code TEXT,
to_country/to_city/to_company/to_address/to_postal_code TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()

-- trip_segments: участки рейса
id UUID, trip_id, position INT,
executor_type TEXT NOT NULL,             -- 'us' | 'contractor'
contractor_id UUID REFERENCES contractors,
truck_id UUID REFERENCES trucks,
driver_id UUID REFERENCES drivers,
date_from DATE, date_to DATE,
from_country/from_city/from_company/from_address/from_postal_code TEXT,
to_country/to_city/to_company/to_address/to_postal_code TEXT,
stops JSONB DEFAULT '[]'::jsonb,
price NUMERIC, currency TEXT DEFAULT 'EUR',
notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()

-- trip_segment_cargo: связь сегмент ↔ грузы
segment_id UUID REFERENCES trip_segments ON DELETE CASCADE,
cargo_id UUID REFERENCES trip_cargo ON DELETE CASCADE,
PRIMARY KEY (segment_id, cargo_id)

-- trip_expenses.segment_id — FK на trip_segments (ON DELETE SET NULL)

-- driver_transactions: расчёты с водителями
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
expense_id UUID REFERENCES trip_expenses(id) ON DELETE SET NULL,
type TEXT NOT NULL CHECK (type IN ('accrual', 'payout')),
amount_eur NUMERIC NOT NULL,
original_amount NUMERIC,
currency TEXT DEFAULT 'EUR',
date DATE NOT NULL,
notes TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
```

**УДАЛЁННЫЕ таблицы:**
- `trip_subcontractors` — DROP (Фаза 3.3, 14.10.2026)

**УДАЛЁННЫЕ колонки из `trips` (Фаза 3.6.7, 14.10.2026):**
- `sender_country`, `sender_city`, `sender_name`, `sender_address`, `sender_postal_code`, `sender_loading_number`
- `sender2_*` … `sender5_*` (те же 6 полей × 4)
- `receiver_country`, `receiver_city`, `receiver_name`, `receiver_address`, `receiver_postal_code`, `receiver_loading_number`
- `route`
- **Итого 37 колонок.**

**ДОБАВЛЕННЫЕ колонки:**
- `trips.created_at TIMESTAMPTZ DEFAULT NOW()` (15.10.2026)
- `trip_expenses.paid_by_driver BOOLEAN DEFAULT FALSE` (15.10.2026)

**SQL-триггеры:**
- `set_trip_number()` + `trg_set_trip_number` (BEFORE INSERT на `trips`) — присваивает `trip_number = MAX+1` (15.10.2026).

**Хелперы:**
- **`lib/trip-route.ts`** — `buildRouteMap(segments: SegmentRouteRow[]): Map<tripId, TripRouteInfo>`
  - `TripRouteInfo = { route, from_city, from_country, to_city, to_country }`
  - `SegmentRouteRow = { trip_id, position, from_city, from_country, to_city, to_country }`
  - ⚠️ **`trip_id` обязателен.** Подавать сырые `*Raw` из supabase, а не UI-модель.
- **`lib/trip-renumber.ts`** — `renumberAllTrips()` — **больше не вызывается** (заменён триггером), оставлен на месте.
- **`lib/trip-task-text.ts`** — текст задания водителю (на сегментах).

---

## 🔒 ЗАКРЫТЫЕ ФАЗЫ

### Фаза 3.1 — удалён `/trips-test` (13.10.2026)

### Фаза 3.2 — уведомления / DOCX для 'us'-сегментов (13.10.2026)
- `SendSegmentTaskButton`, `SegmentDriverDocxButton`, `sendSegmentTaskToDriver`
- Подрядчикам ничего не отправляем — только водителям наших сегментов

### Фаза 3.3 — legacy cleanup (14.10.2026)
- Мигрировали 68 рейсов без сегментов, 19 записей `trip_subcontractors`
- Нормализовали `position`
- **DROP TABLE `trip_subcontractors`**
- Переписаны: `page.tsx` (карточка), `driver/page.tsx`, `today/page.tsx`, `contractors/*`, `driver/trips/[id]/page.tsx`, `reports/contractors/page.tsx`, `task-actions.ts`, `trip-task-text.ts`, `cron/backup`
- Удалены: `SubcontractorsBlock.tsx`, `SubcontractorForm.tsx`, `lib/trip-subcontractors.ts`, `app/api/trips/[id]/subcontractor/...`

### Фаза 3.5 — переход UI/логики на сегменты (14.10.2026)
- **3.5.1–3.5.2** — убраны `sender2..5_*` из форм и экшенов
- **3.5.3** — автосоздание us-сегмента при создании рейса
- **3.5.4–3.5.5** — route из сегментов в списке и карточке
- **3.5.6** — `lib/trip-route.ts`, route из сегментов в export/map/today
- **3.5.7** — фикс `renumberAllTrips`
- **Пакет A** — маршруты (routes, 3 файла)
- **Пакет B** — отчёты (reports, 2 файла)
- **Пакет C** — точечные проверки (search, driver/*):
  - `app/search/actions.ts` — buildRouteMap + trip_segments
  - `app/driver/trips/[id]/page.tsx` — route из сегментов
  - `app/driver/trip-status-actions.ts` — route из сегментов (Telegram)
  - `app/driver/TripsList.tsx` — route/from/to из пропа `segmentsByTrip`
  - `app/driver/page.tsx` — прокидывает `segmentsByTrip`

### Фаза 3.6 — DROP COLUMN + чистка legacy — ✅ ЗАКРЫТА (14.10.2026)
- **3.6.1** — 5 файлов: `check-overlap`, `clients/[id]`, `contractors/[id]`, `drivers/[id]`, `trucks/[id]`.
- **3.6.2** — 1 удаление (`backfill-coordinates/route.ts` — 0 рейсов без координат), остальные 3 (`map/page`, `map/MapView`, `today/page`) уже были чисты.
- **3.6.3** — 5 файлов: `trips/page`, `TripsBulkList` (чист), `trips/[id]/page`, `driver/trips/[id]/page`, `driver/trip-status-actions`.
- **3.6.4** — `lib/trip-task-text.ts` — fallback-блок `sender_*`/`receiver_*` удалён.
- **3.6.5** — 4 файла: `geocode-actions.ts` + `NewTripForm.tsx` (part 1), `trip-actions.tsx` + `EditTripForm.tsx` (part 2) — `sender_*`/`receiver_*` → `from_*`/`to_*`.
- **3.6.6** — 3 файла (`trips/DownloadButton`, `reports/DownloadButton`, `reports/page`) — уже чисты.
- **3.6.7** — ✅ SQL `DROP COLUMN`: удалены 37 колонок.

**🎉 Legacy-модель sender→receiver мертва. Всё через `trip_segments`.**

### Фаза 4 — Расчёты с водителями — ✅ ЗАКРЫТА (15.10.2026)

**Цель:** водитель платит за расходы рейса из своих → компания становится должна → уметь погашать долг.

- **4.1 — ✅** SQL: `driver_transactions` + `trip_expenses.paid_by_driver`. `app/driver-debts-actions.ts`: `getDriverBalance`, `accrueDriverDebt`, `payOutDriverDebt`, `deleteDriverTransaction`. `lib/audit.ts` — `AuditEntityType` расширен `'driver_transaction'`.
- **4.2 — ✅** `app/trip-actions.tsx` (`addExpense`) — создаёт `accrual` при `paid_by_driver=true`. `app/trips/[id]/page.tsx` — чекбокс + бейдж. `app/driver/trips/[id]/page.tsx` — чекбокс **по умолчанию отмечен**.
- **4.3 — ✅** `app/drivers/[id]/page.tsx` — блок «Расчёты» вверху: баланс (цвет), формы «Погасить» + «Начислить вручную», история операций.
- **4.4 — ✅** `app/driver/balance/page.tsx` — новая страница: баланс + история (без форм). `app/driver/page.tsx` — карточка «Мои расчёты» с балансом.

**🎉 Водитель видит свой долг, офис управляет операциями.**

---

## ⏭️ ОЧЕРЕДЬ ЗАДАЧ

### ✅ Сделано (15.10.2026)

1. **`created_at` в `trips`** — SQL, существующие заполнены, новые — автоматически.

2. **Триггер `trip_number` (MAX+1)** — SQL. Убраны вызовы `renumberAllTrips`.
   - Побочный эффект: после удаления рейса — «дырка» в нумерации (норма).
     
3. **ЗП водителю → accrual** (15.10.2026):
   - SQL-миграция старых `salary`-расходов → `driver_transactions`.
   - `app/trips/AddExpenseForm.tsx` — общий client-компонент, чекбокс `paid_by_driver` скрыт при `salary`.
   - `app/trip-actions.tsx` (`addExpense`) — accrual при `paid_by_driver=true` или `category='salary'`.
   - Водитель не может начислять ЗП (`allowSalary={false}` в `/driver/trips/[id]`).
   - `etoll` убран из категорий.
   - **Предупреждение** на `/trips/[id]` — если `status='completed'`, есть водитель, нет `salary`-расхода.
   - **Секция + KPI** на `/today` — «Завершённые рейсы без ЗП».
     
4. **Считывание тахографа и карты водителя** (15.10.2026):
   - SQL: `trucks.tachograph_last_download`, `drivers.driver_card_last_download`.
   - Лимиты: карта водителя — **28 дней** (warn 25), тахограф — **96 дней** (warn 90).
   - `app/driver/reminders/page.tsx` — блок «Считывание данных» + **документы прицепа**.
   - `app/drivers/[id]/page.tsx` — блок считывания карты водителя.
   - `app/drivers/[id]/edit/page.tsx` — поле ввода.
   - `app/driver-actions.ts` — сохранение.
   - `app/trucks/[id]/page.tsx` — блок считывания тахографа (только тягач).
   - `app/trucks/[id]/edit/EditTruckForm.tsx` — поле ввода.
   - `app/truck-actions.ts` — сохранение.

5. **Сортировка на `/trips`** (15.10.2026):
   - Кнопка «По дате старта / Последние созданные».
   - URL: `?sort=created`.
   - При `sort=created` — плоский список (без месячной группировки).

6. **Визитка водителя + телефоны BY/PL** (16.10.2026):
   - SQL: `drivers.passport_series TEXT`, `drivers.passport_issued_date DATE` (`passport_issued_by` уже был).
   - `drivers.phone_by`, `drivers.phone_pl` — уже были, `phone` удалена ранее.
   - **`app/drivers/[id]/page.tsx`** — визитка: фото паспорта, имя, дата рождения, телефоны BY+PL, текущий тягач/прицеп (из активного/планового рейса), паспортные данные (серия, номер, дата выдачи, кем выдан), кнопка «Редактировать».
   - **`app/drivers/[id]/edit/page.tsx`** — поля: `phone_by`, `phone_pl`, `passport_series`, `passport_issued_date`, `passport_issued_by`.
   - **`app/driver-actions.ts`** — сохранение новых полей, `TRACKED_FIELDS` обновлены.
   - **`lib/trip-task-text.ts`** — `DriverInfo` расширен `phone_by?`, `phone_pl?`, `phone?` (optional).
   - **7 файлов** мигрированы с `phone` на `phone_pl || phone_by`:
     - `app/drivers/page.tsx`, `app/drivers/kpi/page.tsx` (2 места), `app/trips/[id]/page.tsx` (2 места — BY+PL в шапке), `app/trips/[id]/task-actions.ts` (4 места), `app/api/trips/[id]/segment/[segId]/driver-docx/route.ts` (2 места — BY·PL через ·), `app/search/actions.ts`, `app/clients/[id]/page.tsx`.

7. **Фото паспорта в визитке водителя** (16.10.2026):
   - Новый client-компонент `app/components/DriverPassportUpload.tsx` — компактная кнопка «📷 Добавить/Сменить фото».
   - Новая функция `replaceDriverPassport(formData)` в `app/driver-actions.ts` — удаляет старые `passport`-документы (Storage + БД), загружает новое, audit.
   - `app/drivers/[id]/page.tsx`:
     - Фото паспорта — **горизонтальное** (`w-56 h-40 md:w-64 md:h-44`), `object-cover`.
     - Кнопка «Сменить фото» под фото (если фото есть) / «Добавить фото» (если нет).
     - Клик по фото → полный размер в новой вкладке.
     - **Удалены** блоки «Загруженные файлы» и «Загрузить документ» (DocumentUpload).
   - **Логика:** при загрузке нового фото — **старые `passport`-документы удаляются** (без галереи).

8. **Проверка дубликатов при создании** (18.10.2026):
   - API `app/api/check-duplicates/route.ts` — поиск по `name` (ilike, частичное) + `tax_id` (для подрядчиков).
   - Client-компонент `app/components/DuplicateChecker.tsx` — live-проверка с debounce 500ms, показывает до 5 совпадений со ссылками на существующих.
   - Вставлен в `/clients/new` (поле «Название компании») и `/contractors/new` (поле «Короткое название»).
   - **Не блокирует** создание — только предупреждает.
   - SQL-проверка показала **0 дубликатов** в БД → страница «Дубликаты» не нужна.

9. **Косметика: псевдонимы `sender_*`/`receiver_*` в UI** (18.10.2026):
   - `app/today/page.tsx` — `from_city`/`from_country`/`to_city`/`to_country` вместо псевдонимов.
   - `app/map/page.tsx` — то же.
   - `app/map/MapView.tsx` — тип `Trip` обновлён: `from_*` / `to_*` (было `sender_*`/`receiver_*`). Попапы маркеров показывают корректные города/страны.
   - **Итог:** UI полностью чист от legacy-псевдонимов.

10. **Считывание в офисных `/reminders`** (18.10.2026):
    - `app/reminders/page.tsx` — новая секция «📥 Считывание тахографа и карт».
    - Запросы `drivers.driver_card_last_download` + `trucks.tachograph_last_download` (только тягачи).
    - Показываются только проблемные: `daysAgo > 25` для карт водителей, `daysAgo > 90` для тахографов.
    - Бейджи: 🔴 просрочено/никогда · 🟠 warn.
    - Клик → карточка водителя/тягача.

### ⏳ В очереди (не срочно)

1. **Печатные формы** — PDF-отчёт по рейсу, акт выполненных работ.
2. **Дубликаты клиентов/подрядчиков** — предупреждение при создании.
3. **Онбординг админа** — сейчас только водительский.
4. **Косметика:** переименовать локальные псевдонимы `sender_city`/`receiver_city` в `map/page.tsx` и `today/page.tsx`.
5. **Автоподстановка координат** — триггер на `trip_segments`.
6. **«Последние созданные» на `/trips`** — сортировка по `created_at`.

## 📊 СОСТОЯНИЕ ДАННЫХ (15.10.2026)

- `trips`: 71 (+ `created_at`)
- `trip_segments`: 94 (71 us + 23 contractor)
- `trip_cargo`: 74
- `trip_segment_cargo`: 79
- `trip_expenses`: ~416
- `driver_transactions`: новая, пока пустая (или с тестовыми)
- `trip_subcontractors`: DROP
- `trucks`: + `tachograph_last_download`
- `drivers`: + `driver_card_last_download`

**Бэкапы:**
- `backup_2026-10-13_0730.json` — до Фазы 3
- `backup_2026-10-14_0607.json` — перед миграцией 3.3.3a
- `backup_2026-10-14_0730.json` — утренний (с legacy-колонками)
- Cron `/api/cron/backup` — ежедневно в 7:00

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
- **Расчёты с водителями** (`driver_transactions`)
- Бэкапы: 18 таблиц (с `driver_transactions`, без `trip_subcontractors`)

### Комбинированные перевозки
- Клиент платит за весь рейс; подрядчик везёт A→C; мы едем C→Б
- `trip_segments` — `executor_type='us'` / `'contractor'`
- У сегмента: `stops` JSONB, `price`, `currency`
- **DOCX подрядчику** — ZLECENIE TRANSPORTOWE
- **DOCX водителю** — «Задание водителю»
- **Telegram водителю** — `SendSegmentTaskButton`

### Дашборд «Сегодня» (`/today`)
- KPI (Загрузок / Выгрузок / В пути / Требует внимания)
- События из рейсов, сегментов, экспедирования

### Отчёт «Ошибки Logisat» (`/reports/logisat`)
- 4 категории + архив; `LogisatProblemsList.tsx` — аккордеон + bulk-синк

### Онбординг водителя
- `drivers.onboarded_at`; рендерится в `app/driver/page.tsx`

### Bulk-операции в рейсах
- `app/trips/bulk-actions.ts` — `bulkSetStatus`, `bulkDelete`
- `app/trips/TripsBulkList.tsx` — чекбоксы, sticky-toolbar

### CSV-экспорт
- `app/api/export/route.ts` — `?format=csv`, `\uFEFF` BOM, `;` разделитель

### Проверка пересечений рейсов
- `app/trips/[id]/edit/OverlapWarning.tsx`
- `app/api/trips/check-overlap/route.ts`

### Расчёты с водителями (Фаза 4)
- Водитель отмечает расход «🚛 Оплатил за свои» → создаётся `accrual` в `driver_transactions`.
- Офис на карточке водителя видит баланс, может **начислить вручную** или **погасить долг**.
- Водитель в `/driver/balance` видит свой баланс и историю.

### Cron
- `/api/update-rates` — `0 6 * * *`
- `/api/cron/reminders` — `0 9 * * *`
- `/api/cron/backup` — `0 7 * * *`

---

## Подводные камни

### PostgREST и FK
У `trips` два FK на `trucks`: `truck_id`, `trailer_id`. Алиасы обязательны:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
```

### Supabase SQL: ошибка 42P10
`UPDATE ... FROM LATERAL` — нельзя ссылаться на таблицу-цель в LATERAL. Решение — CTE.

### Supabase SQL Editor: `ALTER TABLE ... DROP COLUMN a, b, c`
**Не работает** — ошибка `syntax error at or near "b"`.
**Решение:** `DROP COLUMN` **перед каждой колонкой**:
```sql
ALTER TABLE trips
  DROP COLUMN col1,
  DROP COLUMN col2,
  ...
```

### `buildRouteMap` требует `trip_id`
`SegmentRouteRow` содержит **обязательное** поле `trip_id`. Если подать UI-модель (где `trip_id` нет) — type error.
**Решение:** подавать сырые `*Raw` из supabase:
```ts
buildRouteMap((segmentsRaw || []) as SegmentRouteRow[])
```

### `renumberAllTrips`
- Раньше падал: `.select('...created_at')` — колонки нет. Фикс: убрать, tiebreaker `id ASC`.
- **С 15.10.2026 не вызывается** — заменён триггером `set_trip_number`.
- `lib/trip-renumber.ts` оставлен на месте (вдруг пригодится), но не используется.

### Таймауты Vercel-билдов
Static page generation (60s timeout). Лечится: Redeploy без кэша или ретрай.

### Автокоммит
Каждое изменение файла = коммит + билд. 5 правок = 5 билдов. Жрёт квоту Vercel.

### Потеря импорта при правке
При добавлении нового импорта **не удалять существующие** — было с `buildDriverTaskText` в `trips/[id]/page.tsx` (Фаза 3.6.3).

### Обрыв файла при копипасте
При выдаче полного файла **проверять, что дошло до конца** (`}` в конце). Было с `trips/[id]/page.tsx` — оборвался на середине JSX, файл не собрался.

---

## 📋 Шпаргалка по текущему состоянию (15.10.2026)

- `trips`: 71 (+ `created_at`, `trip_number` через триггер)
- `trip_segments`: 94 (71 us + 23 contractor)
- `trip_cargo`: 74, `trip_segment_cargo`: 79, `trip_expenses`: ~416
- `driver_transactions`: новая
- `trip_subcontractors`: DROP

**Закрыто:** Фазы 3.1–3.6 + created_at + триггер trip_number + Фаза 4 + ЗП-логика + тахограф/карта + сортировка.
**В очереди:** см. «Идеи (не срочно)».

---

## 🆕 Условие работы с AI-ассистентом (с 14.10.2026)

**При старте нового чата:**
1. Первое сообщение — **полный HANDOVER** (этот файл), один раз.
2. Второе — **что делаем сейчас**.
3. Третье — **сам файл**, целиком.
4. Дальше — по одному файлу.

**Ассистент обязан предупреждать о контексте:**
- 🟡 — «осталось ~30–40%, пора подумать о сохранении» (в конце ответа)
- 🔴 — «осталось мало, **сейчас** обновляем HANDOVER и новый чат» (в начале ответа)

**Сохраняемся на границах блоков**, не на середине файла:
- Пакет закрыт → обновили HANDOVER → новый чат.
- Фаза закрыта → обновили HANDOVER → новый чат.

**Не загружаем в чат:**
- Бэкапы БД, старые HANDOVER, уже заменённые файлы, логи билдов целиком, огромные JSON/дампы.

**Загружаем:**
- Актуальный HANDOVER (один раз в начале)
- Только те файлы, что правим прямо сейчас
- Результат grep (список, не содержимое)
- Скриншоты ошибок (короткие)

**Цель:** сохранить непрерывность работы через серию коротких чатов, каждый из которых стартует с полного HANDOVER.
