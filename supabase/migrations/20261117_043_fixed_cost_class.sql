-- 043: тип общего расхода — операционный или вне P&L (дивиденды, снятие наличных).
--
-- Дивиденды и снятые наличные видны в «Общих расходах» отдельно, но не уменьшают
-- прибыль и «эффективно в месяц». Добавление колонки с умолчанием 'operating' и правка
-- данных: записи «дивиденды» — 'dividends'. Старый код колонку не читает.

alter table public.fixed_costs
  add column if not exists cost_class text not null default 'operating';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fixed_costs_cost_class') then
    alter table public.fixed_costs
      add constraint fixed_costs_cost_class check (cost_class in ('operating', 'dividends', 'cash'));
  end if;
end $$;

update public.fixed_costs
   set cost_class = 'dividends'
 where cost_class = 'operating'
   and (category ilike '%дивиден%' or category ilike '%dywidend%' or category ilike '%dividend%');

create or replace function public.fixed_costs_by_month(p_year integer)
 returns table (month_key text, amount numeric)
 language plpgsql
 stable
as $$
begin
  return query
    select fc.month_key,
           sum(fc.amount_eur) as amount
      from public.fixed_costs fc
     where fc.month_key is not null
       and fc.month_key like p_year::text || '-%'
       and fc.is_capex is not true
       and fc.cost_class = 'operating'
       and fc.amount_eur is not null
       and fc.amount_eur <> 0
     group by fc.month_key
     order by fc.month_key;
end;
$$;
