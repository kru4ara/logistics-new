# Демо-компания для показа клиентам

Отдельный проект Supabase + отдельный проект Vercel из этого же репозитория, переменная
`DEMO_MODE=1`. Компания «Demo Trans Sp. z o.o.» и все данные вымышленные (`lib/demo/data.ts`):
8 клиентов, 5 перевозчиков, 5 водителей и машин, ~70 заказов за 5 месяцев во всех статусах,
просроченная дебиторка, «К выставлению» с CMR, постоянные расходы.

| Что делает демо-режим | Где |
|---|---|
| жёлтая полоса «Демо-версия» на всех страницах | `app/components/DemoBanner.tsx` |
| вход одной кнопкой: Офис / Бухгалтер / Менеджер / Водитель | `app/login/DemoLoginPanel.tsx` |
| ночной сброс данных «от сегодняшнего дня» (02:00 UTC) и кнопка «Сбросить» на входе (не чаще раза в 10 мин) | `lib/demo/reset.ts`, `/api/cron/demo-reset` |
| запрет того, что сломает демо другим: сотрудники и пароли, 2FA | `app/settings/users/actions.ts`, `app/account/security/actions.ts` |

Сброс стирает базу **только** с меткой демо (`integration_state: demo.marker`) или пустую — на
рабочей базе с заказами он откажется, даже если `DEMO_MODE=1` поставить по ошибке.

Внешние сервисы (фактуры, KSeF, GPS, почта, Telegram) в демо не подключаются: их ключей в
проекте нет. Счёт в демо — «Только отметить выставленным» в карточке заказа.

## Настройка (один раз, ~20 минут)

1. **Supabase** → New project `logistics-demo` (Free, регион eu-west-1). Сохраните пароль базы.
2. **Миграции в демо-базу.** GitHub → Settings → Environments → `migrations`:
   добавьте секрет `TENANTS_JSON` (когда он есть, workflow берёт его вместо `PROD_DATABASE_URL`):
   ```json
   [{"name":"raibuilding","url":"<Session pooler рабочей базы>"},
    {"name":"demo","url":"<Session pooler демо-базы>"}]
   ```
   Затем Actions → Migrations → Run workflow, **снимите** «только план» → Approve. Демо-база
   получит всю схему; дальше каждая миграция идёт в обе базы сама.
3. **Vercel** → Add New → Project → тот же репозиторий, имя `logistics-demo`, переменные:

   | Переменная | Значение |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | демо-проекта (Supabase → Project Settings → API) |
   | `DEMO_MODE` | `1` |
   | `DEMO_PASSWORD` | любой простой пароль — он виден на странице входа (по умолчанию `demo-crm-2026`) |
   | `CRON_SECRET` | любая длинная случайная строка |
   | `NEXT_PUBLIC_APP_URL` | адрес демо, например `https://demo.<ваш домен>` |

   Settings → Deployment Protection → выключить Vercel Authentication (демо должно быть открыто).
4. Откройте демо → страница входа → **«Сбросить демо-данные»** (первое наполнение, ~30 с) →
   войдите кнопкой «Офис».

Код один: каждый merge в `master` обновляет и рабочую CRM, и демо.
