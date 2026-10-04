# HANDOVER — Logistics CRM (04.10.2026)

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
- TELEGRAM_BOT_TOKEN — токен @raibuilding_bot
- TELEGRAM_CHAT_ID — общий чат офиса
- TELEGRAM_WEBHOOK_SECRET — секрет для webhook
- CRON_SECRET — секрет для cron

**Vercel Secret-переменные не редактируются** — только удалить + создать заново.

## Правила работы
- Полные файлы на замену, не куски
- 1 шаг за раз, с проверкой
- Мобильная адаптация: px-4 md:px-6, p-5 md:p-6, text-base в инпутах
- Server components → createClient() из lib/supabase-server
- Клиентского supabase-клиента в проекте больше нет

## Что работает

### Авторизация
- Login через server action + bcrypt.compare + httpOnly cookie
- Logout через server action
- Навбар серверный (Navbar.tsx + NavbarClient.tsx)
- RLS включён, публичные политики удалены

### Домены
- Рейсы (trips + trip_expenses + trip_documents + trip_counter)
- Экспедирование (forwarding_orders + contractors + points + expenses)
- Клиенты, водители, тягачи, локации, подрядчики
- Напоминания + cron рассылки в Telegram (09:00 UTC)
- Logisat: синхронизация рейса, просмотр расхода /driver/logisat
- Курсы валют: cron /api/update-rates (06:00 UTC, open.er-api.com)
- Документы (documents — полиморфная entity_type/entity_id + trip_documents)

### UI / UX
- SubmitButton во всех формах (защита от дублей)
- Toaster через ?toast=... + error.tsx / global-error.tsx
- Глобальный поиск /search?q=... (по 5 доменам)
- Экспорт в Excel /reports/excel (4 выгрузки)
- Прибыльность /reports/profitability (клиенты + тягачи)
- Аудит /audit (журнал изменений)

### Аудит (полное покрытие)
- Таблица audit_log, lib/audit.ts (logAudit + diffFields)
- Логируется: рейсы (CRUD+status), расходы рейсов, клиенты, водители, подрядчики, локации, экспедирование (CRUD+status), расходы экспедирования, напоминания, документы
- Страница /audit — фильтры, русские labels полей, форматирование дат DD.MM.YYYY

### Telegram
- Бот @raibuilding_bot, webhook /api/telegram/webhook
- Driver chat_id сохраняется через /start <driver_id>
- Персональная ссылка в карточке водителя (TelegramLinkCard)
- Уведомления: водителю при новом рейсе, общий чат при смене статуса рейса и загрузке документа

### Бизнес-логика
- Остаток топлива: допуск -200 л (жёлтый/красный по порогам)
- Авто-дата старта нового рейса = end_date предыдущего рейса машины + 1 день
- DOCX подрядчику: Kraj/GPS/Kontakt/Uwagi
- Country у подрядчиков
- PointRow вынесен наружу (баг с фокусом устранён)

## Подводные камни

### PostgREST и двусмысленные FK
У trips **два FK на trucks**: truck_id и trailer_id. Везде указывать алиас:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
