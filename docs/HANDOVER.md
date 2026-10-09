# HANDOVER — Logistics CRM (10.10.2026)

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

## 📁 НОВЫЕ ФАЙЛЫ И ФИЧИ (10.10.2026)

### 🆕 Дашборд «Сегодня» (`/today`)
- **`app/today/page.tsx`** — оперативный экран:
  - KPI: Загрузок / Выгрузок / В пути / Требует внимания
  - Секции: «Загрузки сегодня» (зелёные), «Выгрузки сегодня» (красные), «В пути сейчас», «Требует внимания»
  - События из: рейсов (start_date / end_date = сегодня), подрядчиков (load..load5 / unload_date = сегодня), экспедирования (forwarding_points.date = сегодня)
  - Ссылка на каждое событие → карточка рейса / заявки
- **Sidebar** — добавлен пункт «Сегодня» под «Главная» (только для admin)

### 🆕 Отчёт «Ошибки Logisat» (`/reports/logisat`)
- **`app/reports/logisat/page.tsx`** — 4 категории проблем:
  - 🔴 «Активные — синк не выполнялся» (status='active', logisat_synced_at IS NULL)
  - 🟡 «Синк устарел» (active + синк >7 дней)
  - 🟠 «Одометр не передаёт данные»
  - 🔴 «Топливо не передаёт данные»
  - ⚪ «Архив — синк не выполнялся» (completed/invoiced/paid) — **свёрнут по умолчанию**
  - Плюс «Тягачи без Logisat» (не настроен deviceId / выключен)
- **`app/reports/logisat/LogisatProblemsList.tsx`** — клиентский компонент:
  - Аккордеон (свернуть/развернуть секцию)
  - «Показать все (N)» — первые 9 карточек, дальше по клику
  - **Кнопка «Синкать все (N)»** на активных секциях → bulk-синк
  - Inline-статус: «Готово: X из Y» / «X успешно, Y с ошибкой»
- **`app/api/logisat/sync-bulk/route.ts`** — POST с `{ tripIds: string[] }`, батчи по 3 параллельно
- **`app/reports/page.tsx`** — 4-я карточка «Ошибки Logisat» (оранжевый градиент `from-orange-500 to-orange-700`)

### 🆕 Онбординг водителя
- **SQL миграция выполнена:** `ALTER TABLE drivers ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ DEFAULT NULL;`
- **`app/driver/onboarding-actions.ts`** — `markDriverOnboarded()`
- **`app/driver/OnboardingCard.tsx`** — приветственная карточка с 4 шагами:
  1. «Начни рейс» → кнопка `Начать рейс`
  2. «Заверши рейс» → указать дату финиша
  3. «Загрузи CMR» → фото документа
  4. «Следи за сроками» → раздел Напоминания
  - Кнопка «Всё понял, поехали» → ставит `onboarded_at`, скрывает карточку
- **`app/driver/page.tsx`** — рендерит `<OnboardingCard>` между приветствием и активными рейсами, если `onboarded_at IS NULL`

### 🆕 Bulk-операции в рейсах
- **`app/trips/bulk-actions.ts`** — `bulkSetStatus`, `bulkDelete`
  - Массовая смена статуса (запрещён `completed` — требует end_date)
  - Массовое удаление
  - Логирование audit для каждого рейса отдельно
- **`app/trips/TripsBulkList.tsx`** — клиентский компонент:
  - Чекбоксы на карточках (правый верхний угол)
  - Клик по остальной площади → открытие рейса
  - Sticky-toolbar сверху при выборе: «Выбрано: N», «Выбрать все», «Статус ▾» (dropdown), «Удалить»
- **`app/trips/page.tsx`** — рендерит `<TripsBulkList>`

### 🆕 CSV-экспорт
- **`app/api/export/route.ts`** — параметр `?format=csv`:
  - `XLSX.utils.sheet_to_csv(sheet, { FS: ';' })` — разделитель `;` для русской локали Excel
  - `\uFEFF` BOM в начале — корректная кириллица
  - Файл `.csv` вместо `.xlsx`
- **`app/reports/excel/ExportForm.tsx`** — переключатель «Excel (.xlsx) / CSV (.csv)»

### 🆕 Проверка пересечений рейсов (`trips/[id]/edit`)
- **`app/trips/[id]/edit/OverlapWarning.tsx`** — клиентский компонент:
  - При выборе тягача и дат — проверка через `/api/trips/check-overlap` (GET с `truckId`, `startDate`, `endDate`, `excludeTripId`)
  - Если есть пересечение — **предупреждение** (не блокирующее) с указанием конфликтующего рейса, клиента, маршрута, дат
  - Ссылка «Открыть конфликтующий рейс →»
- **`app/api/trips/check-overlap/route.ts`** — GET-роут, возвращает конфликты
- **`app/trips/[id]/edit/page.tsx`** — подключён `<OverlapWarning>` рядом с полем «Тягач»
- **⚠️ ВАЖНО:** Если не хочешь, чтобы эта фича работала, удали `<OverlapWarning>` из edit-page.

---

## ✨ ЧТО СДЕЛАНО РАНЕЕ (09.10 и до)

### Редизайн (закрыт полностью)
- Главная (`app/page.tsx`) — **компактная**: приветствие, KPI месяц, блок «Требует внимания», «За всё время» (5 карточек), график 12 мес, донат расходов. **Убрано:** Топ-5 клиентов/маршрутов, Последние рейсы/экспедиции
- Пачки 2-5: кнопки, медиа, крупные компоненты, misc — все переделаны в brand-палитру с lucide
- Большие страницы: `forwarding/[id]`, `clients/[id]`, `reports/profitability`, `map/MapView`, `driver/reminders`
- Логин (`app/login/page.tsx`) — брендинг RAIBUILDING, `brand-800` в градиенте
- Empty states: `/reports/profitability`, `/map/MapView`
- Loading-скелетоны: `app/loading.tsx`, `app/trips/loading.tsx`, `app/forwarding/loading.tsx`, `app/drivers/loading.tsx`, `app/trucks/loading.tsx`, `app/clients/loading.tsx`, `app/contractors/loading.tsx`, `app/locations/loading.tsx`, `app/reminders/loading.tsx`, `app/reports/loading.tsx`, `app/trips/[id]/loading.tsx`, `app/forwarding/[id]/loading.tsx`, `app/clients/[id]/loading.tsx`
- Водительский раздел: `app/driver/page.tsx`, `app/driver/TripsList.tsx`, `app/driver/trips/[id]/page.tsx`, `app/driver/stats/page.tsx`

### Фиксы и улучшения
- **Sidebar** — устранены дубли у водителя, добавлены «Сегодня» и общий `isAdmin`-гейт для «Главная»
- **`app/trucks/page.tsx`** — единый empty state (одна большая карточка, если пусто; иначе секции тягачи/прицепы)
- **`app/reports/page.tsx`** — 4 карточки-ссылки (Прибыльность, Ошибки Logisat, Экспорт, Подрядчики)
- **`app/statistics/page.tsx`** — emoji → lucide, `blue-*` → `brand-*`
- **`app/forwarding/page.tsx`** — годы фильтра собираются из данных (а не хардкод `[currentYear, -1, -2]`)
- **`app/forwarding/actions.ts`** — фикс `renumberAllOrders`: обновляем **всех** (а не только тех, у кого номер меняется), двухфазная схема, проверки ошибок
- **`app/statistics/page.tsx`**, `app/driver/reminders/page.tsx` — исправлены поля документов прицепа (`customs_certificate_expiry` вместо `tachograph_legalization_expiry`)
- **`app/driver/stats/page.tsx`** — фикс склейки файла (было «стар + новый в конце»)

### Telegram-уведомления (`app/driver/trip-status-actions.ts`)
- **Водителю лично** — только при **создании** нового рейса (`notifyDriverAboutNewTrip` в `geocode-actions.ts`)
- **В офисный чат** — при `active` («🚛 Рейс №N · Начат») и `completed` («✅ Рейс №N · Завершён»)
- **Не отправляется** при `invoiced` / `paid` / `planned`
- Хелперы `pickOne` / `pickName` для relations

### Заявки экспедирования — перенумерация
- Номера всегда идут `1..N` по `load_date ASC`, `created_at ASC`
- Вызывается при create / update / delete
- Существующие данные выровнены вручную SQL

### Cron
- `/api/update-rates` — `0 6 * * *` — курсы PLN/BYN
- `/api/cron/reminders` — `0 9 * * *` — рассылка напоминаний
- `/api/cron/backup` — `0 7 * * *` — дамп 18 таблиц (10:00 Минск)

---

## Что работает

### Авторизация
- Login через server action + bcrypt.compare + httpOnly cookie
- Logout через server action
- Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx` (клиентский)
- RLS включён, публичные политики удалены

### Домены
- **Рейсы** (`trips` + `trip_expenses` + `trip_documents` + `trip_subcontractors`)
- **Экспедирование** (`forwarding_orders` + `forwarding_contractors` + `forwarding_points` + `forwarding_expenses`)
- Клиенты, водители, тягачи, локации, подрядчики
- Напоминания + cron рассылки в Telegram
- Logisat: синхронизация рейса, просмотр расхода `/driver/logisat`, bulk-синк
- Курсы валют
- Документы
- **Бэкапы**: 18 таблиц, включая `trip_subcontractors`

### Комбинированные перевозки
- Схема: клиент платит за весь рейс; подрядчик везёт A→C; мы едем C→Б
- **`trip_subcontractors`** — до N подрядчиков, у каждого до 5 точек A (`load..load5`)
- **DOCX подрядчику** — ZLECENIE TRANSPORTOWE с N точками A + C

---

## Подводные камни

### PostgREST и FK
У `trips` два FK на `trucks`: `truck_id` и `trailer_id`. Алиасы обязательны:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
