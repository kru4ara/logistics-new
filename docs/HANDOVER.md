# HANDOVER — Logistics CRM (26.10.2026)

## Стек и инфраструктура
- Next.js 15.5.28 (App Router) + React 19.3.1 + Supabase + Vercel
- GitHub: `kru4ara/logistics-new` (master) — автокоммит на каждое изменение
- Prod: https://logistics-new-ebon.vercel.app
- Supabase Project: `logistics-core`, org `Raibuilding`
  - ⚠️ **ПРАВИЛЬНЫЙ REF:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i` после `smodijsj`)
  - ❌ **ОШИБОЧНЫЙ:** `smodijsjwvsscfgloh` (без `i`) → NXDOMAIN
  - **Правило:** копировать ТОЛЬКО кнопкой Copy из Settings → General.
- Vercel project: `kru4aras-projects/logistics-new`

### ENV (Vercel → Settings → Environment Variables)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — клиент, RLS закрыт
- `SUPABASE_SERVICE_ROLE_KEY` — server client, обходит RLS
- `LOGISAT_SERVER` / `LOGISAT_USERNAME` / `LOGISAT_PASSWORD`
- `TELEGRAM_BOT_TOKEN` — @raibuilding_bot
- `TELEGRAM_CHAT_ID` — `921520481`
- `TELEGRAM_WEBHOOK_SECRET` — **обязателен** (если нет, вебхук вернёт 500)
- `CRON_SECRET` — **обязателен** (если нет, cron вернёт 500)

---

## 🚨 Vercel Hobby Лимит и GitHub Outage
Если Vercel не запускает билды после `git push`:
1. Ждать 24 часа.
2. `git commit --allow-empty -m "trigger"` + `git push`.
3. Redeploy вручную.

---

## ⚠️ Правила работы с AI-ассистентом

### Контекст чата — не бесконечный
Не грузить бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.

### Рабочий процесс (Next.js 15)
- Полные файлы на замену, не куски.
- 1 шаг за раз.
- Server components → `createClient()` из `lib/supabase-server` (admin) или `lib/supabase/server` (с сессией).
- **ВСЕГДА** `await cookies()` и `await searchParams`.
- **Один коммит = связанные файлы.**
- **`import` должны быть в начале файла.**

### ⚠️ Git (локально)
- `git pull --no-edit`.
- При `rejected` — `git pull --no-edit`, потом `git push`.
- Конфликт в `package.json` — **наша версия**.
- **Git Bash склеивает команды** — по одной строке.
- **`sed` на JSX — запрещён.**

---

## 📁 Структура проекта

### Гибкая модель рейсов
**`trip_cargo`** — грузы (фрахт, вес, паллеты, таможня).
**`trip_segments`** — участки (исполнитель, машина, водитель, цена).
**`trip_expenses`** — расходы.
**`counters`** — нумерация.
**`profiles`** — роль (`admin` | `driver`) и `driver_id`.

### Supabase Auth
- `lib/supabase-server.ts` (admin, `server-only`)
- `lib/supabase/server.ts` (с сессией)
- `lib/supabase/client.ts` (браузерный)
- `middleware.ts` — белый список ролей (`admin`, `manager`), cron и вебхуки — публичные.
- `app/login/actions.ts` — вход через `signInWithPassword`.

### Хелперы (`lib/`)
- `trip-route.ts`, `trip-task-text.ts`, `trip-renumber.ts`, `statistics.ts`, `profitability.ts`, `geocode.ts`, `translate-pl.ts`, `company.ts`, `audit.ts`, `cron-alert.ts`, `telegram.ts`.

---

## 🔒 Закрытые фазы

### Фазы 3.1–3.6 — legacy cleanup, переход на `trip_segments`
### Фаза 4 — Расчёты с водителями
### Фаза 5 — Груз первичен (заявка создает trip + trip_cargo)
### Фаза 6 — Утилиты и защита (логирование, напоминания, топливо)
### Фаза 7 — KPI водителей с прибылью
### Фаза 8 — Merge tool для подрядчиков — ✅ 21.10
### Фаза 9 — Фильтры на `/reports` — ✅ 21.10
### Фаза 10 — Оптимизация бандла и аудит безопасности — ✅ 21.10
### Фаза 11 — Миграция на Next.js 15 + React 19 — ✅ 21.10
### Фаза 12 — Рефакторинг карточки рейса и UI — ✅ 22.10
### Фаза 13 — Аудит зависимостей и миграция линтера — ✅ 22.10
### Фаза 14 — Ремонт линта (54 ошибки → 0) — ✅ 23.10
### Фаза 15 — Миграция на `exceljs` — ✅ 24.10
### Фаза 16 — Проверка производительности и безопасности — ✅ 24.10
### Фаза 17 — Миграция на Supabase Auth — ✅ 24.10
### Фаза 18 — Улучшения UX/UI и PWA — ✅ 25.10
### Фаза 19 — Инфраструктура и тесты — ✅ 25.10
### Фаза 20 — Рефакторинг гигантских файлов — ✅ 25.10
### Фаза 21 — Аудит безопасности (закрытие дыр) — ✅ 26.10
### Фаза 22 — Рефакторинг карточки рейса — ✅ 26.10
### Фаза 23 — Рефакторинг карточки водителя — ✅ 26.10
### Фаза 24 — Рефакторинг карточки экспедирования — ✅ 26.10
- `app/forwarding/[id]/page.tsx` разбит на `ForwardingHeader`, `ForwardingStatusBlock`, `ForwardingEconomics`, `ForwardingClient`, `ForwardingPoints`, `ForwardingContractors`, `ForwardingDetails`, `ForwardingExpenses`.

---

## 📈 Состояние скорости (26.10.2026)
- **Vercel Speed Insights (Desktop, P75):** **94/100**.
- **First Load JS shared:** 103 kB.

---

## ⏭️ Очередь задач
1. **`eslint-plugin-react`** устарел для React 19.
2. **Tailwind 4 / Next 16** (breaking).
3. **Проверить, что `CRON_SECRET` и `TELEGRAM_WEBHOOK_SECRET` заданы в Vercel.**

---

## 📊 Состояние данных (26.10.2026)
- `trips`: ~75, `trip_segments`: ~98, `trip_cargo`: ~78, `trip_expenses`: ~455.
- `profiles`: 3 записи (1 admin, 2 driver).

---

## 📋 Шпаргалка
- **Supabase ref:** `smodijsj`**`i`**`wcvsscfgloh` (с буквой `i`!)
- **Линт:** `npm run lint` (0 errors, 0 warnings).
- **Тесты:** `npm run test` (Vitest, **28 тестов**).
- **CI:** GitHub Actions (Actions → CI).
- **`package.json` overrides:** `postcss: "^8.5.23"`, `glob: "10.5.0"`.
- **`eslint.config.mjs`:** `FlatCompat` + `compat.extends('next/core-web-vitals')`. `.next` в ignores.
- **`exceljs`:** в `dependencies`, ленивый импорт в клиентах, статический — в API.
- **`npm audit`:** 3 moderate (`postcss-selector-parser` через Tailwind 3) — принятый dev-риск.
- **Аккаунты:** админ — `raibuilding.pl@gmail.com`, водители — `vasiliuk@...`, `kavaliou@...`.
- **PWA:** установка через «Добавить на главный экран».

**Закрыто:** Фазы 3.1–3.24.

---

## 🆕 Условие работы с AI-ассистентом
**При старте нового чата:**
1. Полный HANDOVER (этот файл).
2. Что делаем сейчас.
3. Сам файл, целиком.

**Сигналы:** 🟡 «~30–40%», 🔴 «сохраняемся».
**Не грузим:** бэкапы, старые HANDOVER, заменённые файлы, полные логи, огромные JSON, **секреты**.
**Грузим:** HANDOVER, текущий файл, результат grep, короткий скриншот.
