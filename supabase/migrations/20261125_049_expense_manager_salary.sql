-- 049: категория расхода рейса «ЗП менеджера» (manager_salary).
-- Ограничение категорий только расширяется: старый код пишет те же значения.

begin;

alter table public.trip_expenses drop constraint if exists trip_expenses_category_check;
alter table public.trip_expenses add constraint trip_expenses_category_check CHECK (category = ANY (ARRAY[
  'fuel', 'epi', 'etoll', 'border', 'salary', 'manager_salary', 'contractor', 'permit', 'tlc', 'waiting',
  'repair', 'parking', 'disinfection', 'ex1', 'otkat', 'gps_seal', 'other'
]::text[]));

commit;
