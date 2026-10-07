# HANDOVER — Logistics CRM (07.10.2026)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: kru4ara/logistics-new (master)
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: smodijsjwcvsscfgloh
- Vercel project: kru4aras-projects/logistics-new

## ENV (Vercel → Settings → Environment Variables)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY — для клиента, RLS закрыт
- SUPABASE_SERVICE_ROLE_KEY — server client, обходит RLS
- LOGISAT_SERVER / LOGISAT_USERNAME / LOGISAT_PASSWORD
- TELEGRAM_BOT_TOKEN — токен @raibuilding_bot (отозван 04.10, обновлён)
- TELEGRAM_CHAT_ID — общий чат офиса
- TELEGRAM_WEBHOOK_SECRET — секрет для webhook
- CRON_SECRET — секрет для cron (обновлён 04.10)

**Vercel Secret-переменные не редактируются** — только удалить + создать заново. После замены — обязателен Redeploy.

## Правила работы
- **Полные файлы на замену, не куски** — пользователь просил не давать фрагменты
- 1 шаг за раз, с проверкой между шагами
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Server components → `createClient()` из `lib/supabase-server`
- Клиентского supabase-клиента в проекте больше нет
- **Внимательно с путями импорта:** сколько уровней вложенности — столько `../`. `app/driver/stats/page.tsx` → `../../../lib/...`. `app/driver/page.tsx` → `../../lib/...`

## Что работает

### Авторизация
- Login через server action + bcrypt.compare + httpOnly cookie
- Logout через server action
- Навбар серверный (`Navbar.tsx` + `NavbarClient.tsx`)
- RLS включён, публичные политики удалены
- Страница логина: брендинг RAIBUILDING + форма, золотой грузовик

### Домены
- **Рейсы** (`trips` + `trip_expenses` + `trip_documents` + `trip_subcontractors`)
- **Экспедирование** (`forwarding_orders` + `forwarding_contractors` + `forwarding_points` + `forwarding_expenses`)
- Клиенты, водители, тягачи, локации, подрядчики
- Напоминания + cron рассылки в Telegram (09:00 UTC)
- Logisat: синхронизация рейса, просмотр расхода `/driver/logisat`
- Курсы валют: cron `/api/update-rates` (06:00 UTC, open.er-api.com)
- Документы: `documents` (полиморфная entity_type/entity_id) + `trip_documents`
- **Бэкапы**: cron `/api/cron/backup` (03:00 UTC) → дамп всех таблиц в Telegram

### Комбинированные перевозки (07.10.2026)
Схема: клиент платит за весь рейс; подрядчик везёт часть маршрута A→C; мы едем C→Б.
- **Таблица `trip_subcontractors`** — до N подрядчиков на рейс (для сборных грузов)
- Поля: contractor_id, position, price_eur, original_price, currency, payment_days, truck_number, driver_name, driver_phone, load_date/unload_date/country/city/address/company/postal_code/number, unload_*, notes, transport_type, transport_temperature, cargo_type, cargo_quantity, customs_loading, customs_unloading
- **`trip_expenses.subcontractor_id`** — связка расхода с подрядчиком (FK)
- При сохранении подрядчика автоматически создаётся/обновляется расход `category='contractor'` в `trip_expenses`
- Расход идёт в экономику **рейса**, но НЕ в статистику экспедирования
- **Рейс может быть без машины/водителя/даты старта** — список `/trips` показывает такие в блоке «📝 Без даты старта»
- В карточке рейса (офис): блок **«🚛 Подрядчики на рейсе»** (SubcontractorsBlock + SubcontractorForm)
- В карточке рейса (офис): блок **«🚚 Наш участок (C → Б)»** — точка C = последняя выгрузка подрядчика, точка Б = получатель рейса
- **DOCX подрядчику**: `/api/trips/[id]/subcontractor/[scid]/docx` — ZLECENIE TRANSPORTOWE с клиентским номером (`client_request_number-position`), схемой A→C, деталями перевозки, условиями и печатью
- В **задании водителя** (в `/driver/trips/[id]` и `/driver`): если есть подрядчик — блок «Загрузка (после подрядчика)» показывает точку C, иначе как раньше — точки A

### UI / UX
- SubmitButton во всех ключевых формах (защита от дублей)
- Toaster через `?toast=...` + error.tsx + global-error.tsx
- Глобальный поиск `/search?q=...` (по 5 доменам)
- Экспорт в Excel `/reports/excel` (4 выгрузки)
- Прибыльность `/reports/profitability` (клиенты + тягачи)
- Аудит `/audit` (полное покрытие)
- PWA: иконка на домашнем экране, полноэкранный режим, камера для CMR (`capture="environment"`)
- Красивый логин
- Дашборд с графиками на главной (`DashboardCharts.tsx`): bar chart прибыли по месяцам (SVG на десктопе, горизонтальные полосы на мобильном), donut структуры расходов
- **Статистика водителя** `/driver/stats` — итоги за всё время + разбивка по активным месяцам (рейсы, км, топливо, расход, зарплата), пустые месяцы скрываются
- Ссылки на Logisat и «Моя статистика» на главной `/driver`

### Аудит (полное покрытие)
- Таблица `audit_log`, `lib/audit.ts` (`logAudit` + `diffFields`)
- Логируется: рейсы (CRUD+status), расходы рейсов, клиенты, водители, подрядчики, локации, экспедирование (CRUD+status), расходы экспедирования, напоминания, документы
- Страница `/audit` — фильтры, русские labels, DD.MM.YYYY

### Telegram
- Бот **@raibuilding_bot**, webhook `/api/telegram/webhook`
- `driver telegram_chat_id` — через `/start <driver_id>`
- Персональная ссылка в карточке водителя (`TelegramLinkCard.tsx`)
- Уведомления: водителю при новом рейсе, общий чат при смене статуса рейса и загрузке документа

### Бизнес-логика
- Остаток топлива: допуск -200 л (жёлтый/красный по порогам)
- Авто-дата старта нового рейса = `end_date` предыдущего рейса машины + 1 день (если дата известна)
- DOCX подрядчику (экспедиция): Kraj / GPS / Kontakt / Uwagi
- DOCX подрядчику (рейс): ZLECENIE TRANSPORTOWE с клиентским номером
- Country у подрядчиков
- PointRow вынесен наружу (баг с фокусом устранён)
- Нумерация заявок экспедирования — по дате загрузки, пересчитывается при CRUD

## Cron (Vercel `vercel.json`)
- `/api/update-rates` — `0 6 * * *` — курсы PLN/BYN через `open.er-api.com`
- `/api/cron/reminders` — `0 9 * * *` — рассылка напоминаний в Telegram
- `/api/cron/backup` — `0 3 * * *` — дамп всех таблиц в Telegram (17 таблиц, ~450 КБ, ~7 сек)

## Подводные камни

### PostgREST и двусмысленные FK
У `trips` **два FK на `trucks`**: `truck_id` и `trailer_id`. Везде указывать алиас:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
