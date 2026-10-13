# HANDOVER — Logistics CRM (13.10.2026)

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
- **Полные коды одним блоком** — без разбивки на секции (для удобства копирования)

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
- `.input` — с `focus:ring-brand-500` и **`text-base`** (критично для iOS)
- `.badge`, `.skeleton`, `.scrollbar-thin`

### Иконки
- **Lucide-react** (`^0.460.0`)
- Emoji остались только в `<option>` нативных select, логах/Telegram-сообщениях, `CATEGORY_META` (для donut)

---

## 📁 СТРУКТУРА ПРОЕКТА — НОВЫЕ ФАЙЛЫ

### 🆕 Гибкая модель рейсов (грузы + сегменты)

**Таблицы БД (миграции выполнены):**

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
stops JSONB DEFAULT '[]'::jsonb,          -- [{type:'load'|'reload'|'unload', company, country, city, address, postal_code, date}]
price NUMERIC,                            -- стоимость подрядчику
currency TEXT DEFAULT 'EUR',
notes TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()

-- trip_segment_cargo: связь сегмент ↔ грузы
segment_id UUID REFERENCES trip_segments(id) ON DELETE CASCADE,
cargo_id UUID REFERENCES trip_cargo(id) ON DELETE CASCADE,
PRIMARY KEY (segment_id, cargo_id)

-- trip_expenses.segment_id — FK на trip_segments (ON DELETE SET NULL)
