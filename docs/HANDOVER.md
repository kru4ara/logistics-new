# HANDOVER — Logistics CRM (05.10.2026)

## Стек и инфраструктура
- Next.js 14 (App Router) + Supabase + Vercel
- GitHub: kru4ara/logistics-new (master)
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: smodijsjwcvsscfgloh
- Vercel project: kru4aras-projects/logistics-new

## ENV (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — для клиента, RLS закрыт
- `SUPABASE_SERVICE_ROLE_KEY` — server client, обходит RLS
- `LOGISAT_SERVER` / `LOGISAT_USERNAME` / `LOGISAT_PASSWORD`
- `TELEGRAM_BOT_TOKEN` — токен @raibuilding_bot (обновлён, старый отозван)
- `TELEGRAM_CHAT_ID` — общий чат офиса
- `TELEGRAM_WEBHOOK_SECRET` — секрет для webhook
- `CRON_SECRET` — секрет для cron

**Vercel Secret-переменные не редактируются** — только удалить + создать заново. После замены — обязателен Redeploy.
**Все секреты хранить в менеджере паролей** — иначе «не помню» повторяется.

## Правила работы
- **Полные файлы на замену, не куски** — пользователь просил не давать фрагменты
- 1 шаг за раз, с проверкой между шагами
- Мобильная адаптация: `px-4 md:px-6`, `p-5 md:p-6`, `text-base` в инпутах
- Server components → `createClient()` из `lib/supabase-server`
- Клиентского supabase-клиента в проекте больше нет

## Что работает

### Авторизация
- Login: server action + `bcrypt.compare` + httpOnly cookie
- Logout: server action
- Навбар серверный (`Navbar.tsx` + `NavbarClient.tsx`)
- RLS включён на всех 18 таблицах, публичные политики удалены
- Страница логина: двустворчатый дизайн (брендинг + форма), золотой грузовик RAIBUILDING

### Домены
- Рейсы (`trips` + `trip_expenses` + `trip_documents`)
- Экспедирование (`forwarding_orders` + `forwarding_contractors` + `forwarding_points` + `forwarding_expenses`)
- Клиенты, водители, тягачи, локации, подрядчики
- Напоминания + cron рассылки в Telegram (09:00 UTC)
- Logisat: синхронизация рейса, просмотр расхода `/driver/logisat`
- Курсы валют: cron `/api/update-rates` (06:00 UTC, open.er-api.com)
- Документы: `documents` (полиморфная entity_type/entity_id) + `trip_documents`

### UI / UX
- `SubmitButton` во всех формах (защита от дублей)
- `Toaster` через `?toast=...` + `error.tsx` / `global-error.tsx`
- Глобальный поиск `/search?q=...` (по 5 доменам)
- Экспорт в Excel `/reports/excel` (4 выгрузки)
- Прибыльность `/reports/profitability` (клиенты + тягачи, фильтр по периоду)
- Аудит `/audit` (журнал изменений)
- PWA: манифест, иконки, установка на домашний экран
- Красивый логин
- **Дашборд с графиками на главной** (`app/components/DashboardCharts.tsx`):
  - Bar chart прибыли по месяцам (SVG с осями — на десктопе, горизонтальные полосы — на мобильном)
  - Donut структуры расходов по категориям (все категории, 16-цветная палитра, легенда с прогресс-барами)

### Аудит (полное покрытие)
- Таблица `audit_log`, `lib/audit.ts` (`logAudit` + `diffFields`)
- Логируется: рейсы (CRUD+status), расходы рейсов, клиенты, водители, подрядчики, локации, экспедирование (CRUD+status), расходы экспедирования, напоминания, документы
- `logAudit` не бросает исключений — ошибки в `console.error`

### Telegram
- Бот **@raibuilding_bot**, webhook `/api/telegram/webhook`
- `driver telegram_chat_id` — через `/start <driver_id>`
- Персональная ссылка в карточке водителя (`TelegramLinkCard.tsx`)
- Уведомления: водителю при новом рейсе, общий чат при смене статуса рейса и загрузке документа

### PWA / мобильное
- `app/manifest.ts` — PWA-манифест
- `app/icon.svg` / `app/apple-icon.svg` — иконки (золотой грузовик)
- `app/layout.tsx` — `viewport` (theme #0f172a) + `appleWebApp`
- Дефолтный `app/favicon.ico` удалён (перебивал `icon.svg`)
- Загрузка CMR: две кнопки на мобильном — **📸 Сфотографировать** (`capture="environment"` — сразу камера) и **🖼 Выбрать файл** (галерея/PDF)

### Бэкапы (05.10.2026)
- `/api/cron/backup` — cron `0 3 * * *` (06:00 Минск)
- Дамп всех 17 таблиц + 5000 последних `audit_log` → JSON → Telegram (файлом)
- Первый бэкап: 465 КБ, 839 строк, 0 ошибок
- Cron работает через `CRON_SECRET` от Vercel

### Бизнес-логика
- Остаток топлива: допуск -200 л, жёлтый/красный по порогам
- Авто-дата старта нового рейса = `end_date` предыдущего рейса машины + 1 день
- DOCX подрядчику: `Kraj` / `GPS` / `Kontakt` / `Uwagi`
- Country у подрядчиков
- `PointRow` вынесен наружу (баг с фокусом устранён)

## Подводные камни

### PostgREST и двусмысленные FK
У `trips` **два FK на `trucks`**: `truck_id` и `trailer_id`. Везде указывать алиас:
```ts
.select('*, trucks!truck_id(registration_number), trucks!trailer_id(registration_number)')
