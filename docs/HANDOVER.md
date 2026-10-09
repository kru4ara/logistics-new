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

### Тени (кастомные)
- `shadow-brand` / `shadow-brand-lg` — индиго-тени для активных кнопок
- `shadow-soft` / `shadow-soft-lg` — мягкие серые для карточек

### Анимации
- `animate-fade-in` (200ms)
- `animate-slide-up` (250ms) — появление карточек/секций
- `animate-slide-down` (200ms) — Toaster
- `animate-scale-in` (150ms)

### Утилитарные классы (`app/globals.css`)
- `.card` — `bg-white rounded-2xl border border-slate-100 shadow-soft`
- `.card-hover` — подъём при hover (`md:hover:-translate-y-0.5`, `hover:shadow-soft-lg`)
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- `.input` — инпут с `focus:ring-brand-500`
- `.badge`, `.skeleton`, `.scrollbar-thin`

### Иконки
- **Lucide-react** — установлен (`^0.460.0`), используется во всём новом UI
- Emoji остались только: в `<option>` (нативный select), в логах/Telegram-сообщениях

---

## 📁 Структура проекта (карта)


---

## ✨ Что сделано 08-09.10.2026

### 09.10.2026 — РЕДИЗАЙН (главная работа дня)

**Инфраструктура дизайна:**
- Установлен `lucide-react`
- `tailwind.config.js` — палитра `brand`/`accent`/`ink`, тени, анимации
- `app/globals.css` — классы `.card`, `.btn-primary`, `.input`, `.badge`
- `app/components/CountryFlag.tsx` — SVG-флаги (работает на Windows, где emoji-флаги не рендерятся)

**Sidebar (полностью новый):**
- `AppShell.tsx` + `AppShellClient.tsx` + `Sidebar.tsx` + `Navbar.tsx`
- Логика: **свёрнут 64px по умолчанию → hover раскрывает → pin-кнопка фиксирует 240px**
- `localStorage` хранит `sidebar-pinned`
- На мобильном (<768px) — выезжающий drawer с overlay
- `NavbarClient.tsx` — **УДАЛЁН** (заменён)

**Редизайн завершён по:**
- ✅ Главная (`app/page.tsx`)
- ✅ Рейсы: `/trips`, `/trips/new` (page), `/trips/[id]`, `/trips/[id]/edit` (page)
- ✅ Водители: список, KPI, карточка, new, edit
- ✅ Транспорт: список, карточка, new, edit
- ✅ Клиенты: список, new, edit
- ✅ Подрядчики: список, карточка, new, edit
- ✅ Локации: список, new, edit
- ✅ Общие расходы: список, new, edit (**+ инвестиции отделены**, поле `is_capex`)
- ✅ Напоминания: список, new, edit
- ✅ Экспедирование: список, new (page + форма), edit (page + форма)
- ✅ Аудит, Поиск, Карта, Logisat (page)
- ✅ Компоненты: `SubmitButton`, `Toaster`, `CopyBlock`, `DocumentUpload`, `DocumentList`

**Статистика:**
- ✅ Разделение P&L и инвестиций (`is_capex` в `fixed_costs`)
- ✅ На главной — 5-я карточка «Инвестиции» (оранжевая)
- ✅ График прибыли по месяцам без инвестиций
- ✅ Легенда с формулами и правилами

**Логика:**
- ✅ «Рейсы за месяц» — по `end_date || start_date` (было по start_date)
- ✅ «ЗП за месяц» — по `expense_date` (дате выплаты), а не по рейсу
- ✅ Синхронизировано в `/driver`, `/driver/stats`, `/drivers/kpi`

### 08.10.2026 (предыдущая сессия)

- 🧹 Чистка данных: 11 зомби-напоминаний, опечатка `20231-05-19`, дубль GORTRANS
- 🛠 Фикс cron backup — добавлена `trip_subcontractors` (была пропущена!)
- 🛠 Мониторинг cron — `lib/cron-alert.ts`, алерты в Telegram при ошибках
- 🛠 Пагинация бэкапа (>1000 строк)
- 🚛 До 5 точек загрузки у рейса (`sender1..5`)
- 🚛 До 5 точек A у подрядчика (`load..load5`) — маршрут A1 → A2 → … → C
- 🚛 Селект «📦 Точка загрузки рейса» в форме подрядчика
- 🚛 DOCX подрядчику с N точками A + C
- 📊 Отчёт `/reports/contractors` (36 подрядчиков)
- 🚚 Раздел Транспорт: новые поля `brand`, `model`, `year`, `vin`, `to_expiry`, `tachograph_calibration_expiry`, `customs_certificate_expiry` — разные документы для тягача/прицепа
- ✅ Загружены данные всех 4 машин (WI042NM, WI652AX, LRA49YH, LRA59818)

---

## 🔴 ЧТО ОСТАЛОСЬ В РЕДИЗАЙНЕ

### Пачка 2 (кнопки и формы — 4 файла):
- `app/trips/[id]/SendTaskButton.tsx`
- `app/driver/TripStatusButtons.tsx`
- `app/forwarding/[id]/ForwardingStatusButtons.tsx`
- `app/trips/[id]/SyncLogisatButton.tsx`

### Пачка 3 (медиа — 3 файла):
- `app/driver/FileUpload.tsx`
- `app/drivers/[id]/TelegramLinkCard.tsx`
- `app/forwarding/[id]/ContractorDocxButton.tsx`

### Пачка 4 (крупняк — по одному):
- `app/trips/[id]/SubcontractorsBlock.tsx` (14.6 KB)
- `app/trips/[id]/SubcontractorForm.tsx` (29 KB)
- `app/reminders/ReminderCard.tsx` (7 KB)
- `app/logisat/LogisatTestForm.tsx` (15 KB)
- `app/driver/logisat/LogisatForm.tsx` (7.2 KB)

### Пачка 5 (misc):
- `app/reports/excel/ExportForm.tsx`
- `app/reports/DownloadButton.tsx` + `app/routes/DownloadButton.tsx` + `app/trips/DownloadButton.tsx`
- `app/login/LoginForm.tsx`

### Ещё не переделаны (страницы):
- `app/forwarding/[id]/page.tsx` (28 KB — большая!)
- `app/clients/[id]/page.tsx`
- `app/reports/profitability/page.tsx`
- `app/map/MapView.tsx` (только контейнер переделан)
- `app/driver/reminders/page.tsx`
- `app/logisat/LogisatTestForm.tsx`

---

## Что работает

### Авторизация
- Login через server action + bcrypt.compare + httpOnly cookie
- Logout через server action
- Sidebar серверный → `AppShell.tsx` → `Sidebar.tsx` (клиентский)
- RLS включён, публичные политики удалены
- Страница логина: брендинг RAIBUILDING + золотой грузовик (**НЕ переделана в новом стиле**)

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
