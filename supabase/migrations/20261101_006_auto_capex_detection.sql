-- 20261101_006_auto_capex_detection.sql
--
-- Инвестиции (CAPEX) больше не размечаются вручную: признак
-- выводится из категории и суммы (lib/capex.ts). Раньше флаг
-- is_capex оставался default false - в форме общего расхода
-- такого поля не было, и инвестиции попадали в прибыль.
--
-- 1) колонка с правилом, по которому признак был проставлен;
-- 2) дозаполнение признака для записей, созданных до этого.

alter table public.fixed_costs
  add column if not exists capex_rule text;

comment on column public.fixed_costs.capex_rule is
  'Правило автоопределения CAPEX: asset | purchase | below_threshold | none';

update public.fixed_costs
set is_capex = true,
    capex_rule = 'asset'
where is_capex is not true
  and amount_eur >= 1000
  and (
    category ilike '%покупк%'
    or category ilike '%приобрет%'
    or category ilike '%scania%'
    or category ilike '%прицеп%'
    or category ilike '%wielton%'
    or category ilike '%тягач%'
    or category ilike '%трактор%'
  );

update public.fixed_costs
set capex_rule = 'none'
where capex_rule is null;
