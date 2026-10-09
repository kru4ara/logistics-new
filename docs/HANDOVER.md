[file name]: HANDOVER — Logistics CRM (09.10.2026).txt
[file content begin]
# HANDOVER — Logistics CRM (09.10.2026)

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
  - **Компоненты лежат в `app/components/`, а `lib/` — в корне проекта** (проверять оба)
- **НЕ пишу код вслепую** — всегда запрашивать актуальную версию файла перед заменой

---

## 🎨 ДИЗАЙН-СИСТЕМА (внедрена 09.10.2026)

### Палитра (`tailwind.config.js`)
- **`brand`** — индиго/фиолет (заменил `blue-600`): `bg-brand-600`, `text-brand-600`, `hover:bg-brand-700`
- **`accent`** — фиолетовый (для градиентов с `brand`)
- **`ink`** — тёмный (для sidebar, `bg-ink-900` = `#0f172a`)
- **`rounded-3xl`** переопределён на `1.25rem` (20px вместо дефолтных 24px)

### Тени (кастомные)
- `shadow-brand-sm`, `shadow-brand` / `shadow-brand-lg` — индиго-тени для активных кнопок
- `shadow-soft` / `shadow-soft-lg` — мягкие серые для карточек

### Анимации
- `animate-fade-in` (200ms)
- `animate-slide-up` (250ms) — появление карточек/секций
- `animate-slide-down` (200ms) — Toaster
- `animate-scale-in` (150ms) — модалки
- `animate-shimmer` (2s linear infinite)

### Утилитарные классы (`app/globals.css`)
- `.card` — `bg-white rounded-2xl border border-slate-100 shadow-soft`
- `.card-hover` — подъём при hover (`md:hover:-translate-y-0.5`, `hover:shadow-soft-lg`)
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- `.input` — инпут с `focus:ring-brand-500` и **`text-base`** (критично для iOS — иначе Safari зумит при фокусе)
- `.badge`, `.skeleton`, `.scrollbar-thin`
- `:focus-visible` — `2px solid brand.500`

### Иконки
- **Lucide-react** — установлен (`^0.460.0`), используется во всём новом UI
- Emoji остались только: в `<option>` (нативный select), в логах/Telegram-сообщениях, в `CATEGORY_META` (для donut и select'ов)

### Компоненты shadcn (`components/ui/`)
- `button.tsx`, `card.tsx`, `input.tsx`, `table.tsx` — существуют, используют `cn()` (clsx + tailwind-merge) для merge классов
- `@/components/ui/button` — импортируется в 3-х `DownloadButton.tsx`

---

## 📁 Структура проекта (карта)


---

## ✨ Что сделано

### 09.10.2026 — Сессия №2 (продолжение редизайна)

**Пачка 2 — кнопки и формы (4 файла):**
- ✅ `app/trips/[id]/SendTaskButton.tsx`
- ✅ `app/driver/TripStatusButtons.tsx`
- ✅ `app/forwarding/[id]/ForwardingStatusButtons.tsx`
- ✅ `app/trips/[id]/SyncLogisatButton.tsx`

**Пачка 3 — медиа (3 файла):**
- ✅ `app/driver/FileUpload.tsx`
- ✅ `app/drivers/[id]/TelegramLinkCard.tsx`
- ✅ `app/forwarding/[id]/ContractorDocxButton.tsx`

**Пачка 4 — крупные компоненты (5 файлов):**
- ✅ `app/trips/[id]/SubcontractorsBlock.tsx`
- ✅ `app/trips/[id]/SubcontractorForm.tsx`
- ✅ `app/reminders/ReminderCard.tsx`
- ✅ `app/logisat/LogisatTestForm.tsx`
- ✅ `app/driver/logisat/LogisatForm.tsx`

**Пачка 5 — misc (5 файлов):**
- ✅ `app/reports/excel/ExportForm.tsx`
- ✅ `app/reports/DownloadButton.tsx`
- ✅ `app/trips/DownloadButton.tsx`
- ✅ `app/routes/DownloadButton.tsx`
- ✅ `app/login/LoginForm.tsx`

**Большие страницы:**
- ✅ `app/forwarding/[id]/page.tsx` (28 KB)
- ✅ `app/clients/[id]/page.tsx`
- ✅ `app/reports/profitability/page.tsx`
- ✅ `app/map/MapView.tsx` — кластер перекрашен в brand-600/brand-800, emoji из popup убраны (заменены цветными кружками через inline-style)
- ✅ `app/driver/reminders/page.tsx`

**Главная (компактная версия):**
- ✅ `app/page.tsx` — **СОКРАЩЕНА**:
  - Оставлено: приветствие, KPI месяц (4 карточки), **блок «Требует внимания» (НОВЫЙ)**, «За всё время» (5 карточек), график 12 мес, донат расходов
  - **Убрано:** Топ-5 клиентов, Топ-5 маршрутов, «Последние рейсы», «Последние экспедиции»
  - Emoji в подписях KPI → иконки `Truck`/`Package`/`Briefcase`
  - Убраны неиспользуемые импорты (`Users`, `RouteIcon`) и функция `pickName`
  - Блок «Требует внимания»: показывает просроченные напоминания (красные) и ≤7 дней (оранжевые), топ-3 каждого, ссылка на `/reminders`

**Страница логина:**
- ✅ `app/login/page.tsx` — `blue-900`→`brand-800`, `blue-500/10`→`brand-500/10`, `via-blue-50/30`→`via-brand-50/30`, emoji-бейджи (📡/🔒) → `RadioTower`/`Lock`. Брендинг RAIBUILDING + золотой SVG-грузовик **сохранён**

**Служебные страницы (проверены, уже были в новом стиле):**
- ✅ `app/search/page.tsx`
- ✅ `app/audit/page.tsx`
- ✅ `app/routes/page.tsx`

**Прочее:**
- ✅ `app/trucks/page.tsx` — единый empty state (одна большая карточка, если пусто; иначе — секции тягачи/прицепы)
- ✅ `app/reports/page.tsx` — emoji → lucide (Coins/BarChart3/Download/Truck/TrendingUp/TrendingDown/Wallet/Inbox), `blue-*` → `brand-*`, quick-links через иконки в полупрозрачных кружках
- ✅ `app/statistics/page.tsx` — emoji → lucide (BarChart3/Trophy/TrendingUp/TrendingDown/Wallet/Briefcase/Truck/Package/Calendar/Sigma/Info/Ban), `blue-*` → `brand-*`, добавлены `tabular-nums` в числовые ячейки

**Sidebar — фикс дублей у водителя:**
- ✅ `app/components/Sidebar.tsx`:
  - Убрано «Напоминания» из `driverSections` (было и там, и в нижнем блоке)
  - Верхний блок «Главная» показывается **только для админа** (у водителя роль главной играет «Мои рейсы»)
  - Итог для driver: `МОЁ` → «Мои рейсы» + отдельный блок «Напоминания» внизу

**Loading-скелетоны (10 файлов, все новые):**
- ✅ `app/loading.tsx` — главная (KPI + за всё время + графики + донат)
- ✅ `app/trips/loading.tsx` — эталон (фильтр + 6 карточек)
- ✅ `app/forwarding/loading.tsx` — фильтр (год/месяц/итоги) + 6 карточек
- ✅ `app/drivers/loading.tsx` — заголовок + 2 кнопки + 6 карточек
- ✅ `app/trucks/loading.tsx` — 2 секции (тягачи/прицепы) × 3 карточки
- ✅ `app/clients/loading.tsx` — 6 карточек с кнопками
- ✅ `app/contractors/loading.tsx` — 6 карточек с бейджами
- ✅ `app/locations/loading.tsx` — 6 карточек с типами
- ✅ `app/reminders/loading.tsx` — KPI + фильтр + 6 карточек
- ✅ `app/reports/loading.tsx` — 3 градиентные + счётчики + таблица

### 09.10.2026 — Сессия №1 (начало редизайна)

**Инфраструктура дизайна:**
- Установлен `lucide-react`
- `tailwind.config.js` — палитра `brand`/`accent`/`ink`, тени, анимации
- `app/globals.css` — классы `.card`, `.btn-primary`, `.input`, `.badge`
- `app/components/CountryFlag.tsx` — SVG-флаги

**Sidebar (архитектура):**
- `AppShell.tsx` + `AppShellClient.tsx` + `Sidebar.tsx` + `Navbar.tsx`
- Логика: свёрнут 64px → hover раскрывает → pin фиксирует 240px
- `localStorage` хранит `sidebar-pinned`
- На мобильном — выезжающий drawer с overlay
- `NavbarClient.tsx` — УДАЛЁН

**Редизайн завершён по (сессия 1):**
- ✅ `/trips` (list/new/[id]/[id]/edit)
- ✅ Водители: список, KPI, карточка, new, edit
- ✅ Транспорт: список, карточка, new, edit
- ✅ Клиенты: список, new, edit
- ✅ Подрядчики: список, карточка, new, edit
- ✅ Локации: список, new, edit
- ✅ Общие расходы: список, new, edit (**+ инвестиции отделены**, поле `is_capex`)
- ✅ Напоминания: список, new, edit
- ✅ Экспедирование: список, new, edit
- ✅ Компоненты: `SubmitButton`, `Toaster`, `CopyBlock`, `DocumentUpload`, `DocumentList`

**Статистика (сессия 1):**
- ✅ Разделение P&L и инвестиций (`is_capex` в `fixed_costs`)
- ✅ На главной — 5-я карточка «Инвестиции» (оранжевая)
- ✅ График прибыли по месяцам без инвестиций
- ✅ Легенда с формулами и правилами
- ✅ «Рейсы за месяц» — по `end_date || start_date`
- ✅ «ЗП за месяц» — по `expense_date`

### 08.10.2026 (предыдущая сессия)

- 🧹 Чистка данных: 11 зомби-напоминаний, опечатка `20231-05-19`, дубль GORTRANS
- 🛠 Фикс cron backup — добавлена `trip_subcontractors`
- 🛠 Мониторинг cron — `lib/cron-alert.ts`, алерты в Telegram
- 🛠 Пагинация бэкапа (>1000 строк)
- 🚛 До 5 точек загрузки у рейса (`sender1..5`)
- 🚛 До 5 точек A у подрядчика (`load..load5`) — маршрут A1 → A2 → … → C
- 🚛 Селект «📦 Точка загрузки рейса» в форме подрядчика
- 🚛 DOCX подрядчику с N точками A + C
- 📊 Отчёт `/reports/contractors` (36 подрядчиков)
- 🚚 Раздел Транспорт: новые поля `brand`, `model`, `year`, `vin`, `to_expiry`, `tachograph_calibration_expiry`, `customs_certificate_expiry`
- ✅ Загружены данные всех 4 машин (WI042NM, WI652AX, LRA49YH, LRA59818)

---

## ✅ РЕДИЗАЙН ЗАКРЫТ ПОЛНОСТЬЮ

Все файлы из плана переделаны. Остались только опциональные улучшения:
- Пиксельные доработки по итогам тестов на реальных устройствах
- Loading states для вложенных маршрутов (`/trips/[id]`, `/forwarding/[id]`, `/clients/[id]`) — сейчас покрыты только списки
- Пустые состояния для `/reports/profitability`, `/map` (не критично, там свои заглушки)

---

## 🎯 Паттерны дизайна (прижились)

### Empty state
```tsx
<div className="card p-10 md:p-16 text-center animate-fade-in">
  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
    <Icon className="w-8 h-8 text-brand-600" strokeWidth={1.5} />
  </div>
  <h2 className="text-xl font-bold text-slate-900 mb-2">Заголовок</h2>
  <p className="text-slate-500 mb-6 max-w-md mx-auto">Объяснение</p>
  <a href="..." className="btn btn-primary inline-flex">
    <Plus className="w-4 h-4" />
    CTA
  </a>
</div>

### Модалка
```tsx
<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fade-in">
  <div className="bg-white rounded-2xl shadow-soft-lg max-w-md w-full p-5 md:p-6 animate-scale-in">
```

### Loading skeleton
```tsx
<div className="skeleton h-4 w-32" />
```

### Цвета статусов (единообразно везде)
```
planned:   bg-slate-100  text-slate-700   border-slate-200
active:    bg-brand-50   text-brand-700   border-brand-200
completed: bg-green-50   text-green-700   border-green-200
invoiced:  bg-yellow-50  text-yellow-700  border-yellow-200
paid:      bg-emerald-50 text-emerald-700 border-emerald-200
```
Полоска карточки: `bg-brand-500` для active (было `bg-blue-500`).

### Toaster (URL-driven)
- Server actions → `redirect('/path?toast=key')`
- `Toaster.tsx` ловит `searchParams`, показывает сообщение, чистит URL через 3 сек
- Словарь `MESSAGES` содержит все ключи (trip_created, forwarding_deleted, expense_added и т.д.)
- Подключён в `layout.tsx` через `<Suspense>`

### Server actions
- Формы используют `redirect('/path?toast=key')` для уведомлений
- `revalidatePath` для сброса кэша
- Клиентские actions (через `useTransition` + `router.refresh()`) — **без redirect**, показывают локальный статус внутри компонента (пример: `SendTaskButton`, `ReminderCard`)

---

## Что работает

### Авторизация
- Login через server action + bcrypt.compare + httpOnly cookie
- Logout через server action
- Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx` (клиентский)
- RLS включён, публичные политики удалены
- Страница логина: брендинг RAIBUILDING + золотой грузовик (**в новой палитре, amber-акцент сохранён**)

### Домены
- **Рейсы** (`trips` + `trip_expenses` + `trip_documents` + `trip_subcontractors`)
- **Экспедирование** (`forwarding_orders` + `forwarding_contractors` + `forwarding_points` + `forwarding_expenses`)
- Клиенты, водители, тягачи, локации, подрядчики
- Напоминания + cron рассылки в Telegram (09:00 UTC)
- Logisat: синхронизация рейса, просмотр расхода `/driver/logisat`
- Курсы валют: cron `/api/update-rates` (06:00 UTC)
- Документы: `documents` + `trip_documents`
- **Бэкапы**: cron `/api/cron/backup` (07:00 UTC → 10:00 Минск) → 18 таблиц

### Комбинированные перевозки
- Схема: клиент платит за весь рейс; подрядчик везёт A→C; мы едем C→Б
- **`trip_subcontractors`** — до N подрядчиков, у каждого до 5 точек A (`load..load5`)
- **`trip_expenses.subcontractor_id`** — FK, `ON DELETE CASCADE`
- **DOCX подрядчику** — ZLECENIE TRANSPORTOWE с N точками A + C

---

## Cron (Vercel `vercel.json`)
- `/api/update-rates` — `0 6 * * *` — курсы PLN/BYN
- `/api/cron/reminders` — `0 9 * * *` — рассылка напоминаний
- `/api/cron/backup` — `0 7 * * *` — дамп 18 таблиц (10:00 Минск)

---

## Подводные камни

### PostgREST и FK
У `trips` два FK на `trucks`: `truck_id` и `trailer_id`. Алиасы обязательны:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
```

### `SubmitButton.tsx`
Логика: `className ? className : defaultClass`. Если передан `className`, дефолтные классы **не применяются**. В `forwarding/[id]/page.tsx` передаётся полный набор — работает корректно.

### `components/ui/button.tsx` (shadcn)
Мержит классы через `cn()` (clsx + tailwind-merge). В `DownloadButton.tsx` иконка передаётся внутрь `<Button>`, конфликтов нет.

### `MapView.tsx`
Маркеры и кластеры — это raw HTML/CSS внутри `L.divIcon`. Emoji в popup убраны (заменены цветными кружками через inline-style). Кластер: `linear-gradient(135deg, #4f46e5, #3730a3)`.

### `viewport` в `layout.tsx`
`maximumScale: 1, userScalable: false` — блокирует pinch-zoom. Полезно для iOS при фокусе на инпут, но формально нарушает WCAG 1.4.4. **Осознанное решение.**

### iOS Safari
`.input` содержит `text-base` — обязательно (иначе зум при фокусе).

---
