-- ============================================================
-- Проверка поведения RLS-политик (assertions)
-- ============================================================
-- Запускается в CI на чистом Postgres: .github/workflows/rls.yml
--
-- Проверяем не синтаксис, а ПОВЕДЕНИЕ: что дыра из фазы 31
-- (водитель видит чужой рейс) закрыта на уровне БД.
--
-- Каждая проверка — DO-блок с assert: при несовпадении он бросает
-- исключение, и весь файл (psql -v ON_ERROR_STOP=1) падает -> job красный.
--
-- Роли: office (admin/manager) и driver.
-- ============================================================

\set ON_ERROR_STOP on

-- Хелпер: проверяет, что запрос возвращает ожидаемое число строк.
create or replace function public.assert_count(
  p_label text, p_expected int, p_query text
) returns void
language plpgsql
as $$
declare
  v_actual int;
begin
  execute p_query into v_actual;
  if v_actual is distinct from p_expected then
    raise exception 'FAIL: % — ожидалось %, получено %',
      p_label, p_expected, v_actual;
  end if;
  raise notice 'ok: % = %', p_label, v_actual;
end;
$$;


-- ============================================================
-- Данные
-- ============================================================
insert into public.profiles (id, role, driver_id, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'admin',  null,                          'Офис'),
  ('22222222-2222-2222-2222-222222222222', 'driver','dddddddd-dddd-dddd-dddd-dddddddddddd','Водитель А'),
  ('33333333-3333-3333-3333-333333333333', 'driver','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','Водитель Б');

insert into public.drivers (id, first_name, last_name, email) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'А', 'Водитель', 'a@x.local'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Б', 'Водитель', 'b@x.local');

insert into public.clients (id, name) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Клиент 1'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Клиент 2');

insert into public.trips (id, trip_number, driver_id, client_id, status) values
  ('11111111-aaaa-1111-1111-111111111111', 'T-1', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active'),
  ('22222222-bbbb-2222-2222-222222222222', 'T-2', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'active');

-- Водитель Б назначен на СЕГМЕНТ рейса T-1, но не на рейс целиком.
-- Ключевой кейс фазы 33: код это допускает (isTripOwner || isSegmentOwner),
-- значит RLS тоже должен.
insert into public.trip_segments (id, trip_id, driver_id, position, executor_type) values
  ('33333333-cccc-3333-3333-333333333333', '11111111-aaaa-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 'us'),
  ('44444444-dddd-4444-4444-444444444444', '11111111-aaaa-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 2, 'us');

insert into public.trip_expenses (id, trip_id, category, amount_eur) values
  ('55555555-eeee-5555-5555-555555555555', '11111111-aaaa-1111-1111-111111111111', 'fuel', 100),
  ('66655555-ffff-6666-6666-666666666666', '22222222-bbbb-2222-2222-222222222222', 'fuel', 200);

insert into public.trip_documents (id, trip_id, document_type, file_path) values
  ('77755555-9999-7777-7777-777777777777', '11111111-aaaa-1111-1111-111111111111', 'cmr', 'a.pdf');

insert into public.driver_transactions (id, driver_id, type, amount_eur) values
  ('88855555-aaaa-8888-8888-888888888888', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accrual', 500);

insert into public.documents (id, entity_type, entity_id, file_path) values
  ('99955555-bbbb-9999-9999-999999999999', 'driver', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'passport-a.pdf');

insert into public.trucks (id, registration_number, type, logisat_enabled, logisat_device_id) values
  ('aaaa5555-cccc-aaaa-aaaa-aaaaaaaaaaaa', 'A-1', 'tractor', true, 'dev-1');

insert into public.rates (rate_date, pln_to_eur, byn_to_eur) values ('2026-01-01', 0.23, 0.28);

insert into public.reminders (id, title, entity_type, entity_id, status) values
  ('bbbb5555-dddd-bbbb-bbbb-bbbbbbbbbbbb', 'Права', 'driver', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'active');


-- ============================================================
-- ОФИС: видит всё
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

select public.assert_count('office: trips', 2, 'select count(*) from public.trips');
select public.assert_count('office: expenses', 2, 'select count(*) from public.trip_expenses');
select public.assert_count('office: drivers', 2, 'select count(*) from public.drivers');
select public.assert_count('office: clients', 2, 'select count(*) from public.clients');
select public.assert_count('office: reminders', 1, 'select count(*) from public.reminders');
select public.assert_count('office: profiles', 3, 'select count(*) from public.profiles');
select public.assert_count('office: documents', 1, 'select count(*) from public.documents');
select public.assert_count('office: driver_transactions', 1, 'select count(*) from public.driver_transactions');
select public.assert_count('office: trip_segments', 2, 'select count(*) from public.trip_segments');
select public.assert_count('office: trip_documents', 1, 'select count(*) from public.trip_documents');
select public.assert_count('office: rates', 1, 'select count(*) from public.rates');
select public.assert_count('office: trucks', 1, 'select count(*) from public.trucks');


-- ============================================================
-- ВОДИТЕЛЬ А: свой рейс T-1
-- ============================================================
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

select public.assert_count('driver A: own trip', 1, 'select count(*) from public.trips');
select public.assert_count('driver A: own expense', 1, 'select count(*) from public.trip_expenses');
select public.assert_count('driver A: own trip document', 1, 'select count(*) from public.trip_documents');
select public.assert_count('driver A: own profile only', 1, 'select count(*) from public.profiles');
select public.assert_count('driver A: self in drivers', 1, 'select count(*) from public.drivers');
select public.assert_count('driver A: client of own trip', 1, 'select count(*) from public.clients');
select public.assert_count('driver A: own transaction', 1, 'select count(*) from public.driver_transactions');
select public.assert_count('driver A: own document', 1, 'select count(*) from public.documents');
select public.assert_count('driver A: own reminder', 1, 'select count(*) from public.reminders');
select public.assert_count('driver A: rates visible', 1, 'select count(*) from public.rates');
select public.assert_count('driver A: trucks visible', 1, 'select count(*) from public.trucks');


-- ============================================================
-- ВОДИТЕЛЬ Б: назначен на СЕГМЕНТ рейса T-1, рейс ведёт водитель А
-- ============================================================
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);

select public.assert_count('driver B: trip via own segment', 1, 'select count(*) from public.trips');
select public.assert_count('driver B: segments of own trip', 2, 'select count(*) from public.trip_segments');
select public.assert_count('driver B: expenses of own trip', 1, 'select count(*) from public.trip_expenses');
select public.assert_count('driver B: documents of own trip', 1, 'select count(*) from public.trip_documents');
select public.assert_count('driver B: NO foreign transaction', 0, 'select count(*) from public.driver_transactions');
select public.assert_count('driver B: NO foreign profile', 1, 'select count(*) from public.profiles');
select public.assert_count('driver B: NO foreign document', 0, 'select count(*) from public.documents');
select public.assert_count('driver B: NO foreign reminder', 0, 'select count(*) from public.reminders');
select public.assert_count('driver B: NO foreign driver row', 1, 'select count(*) from public.drivers');


-- ============================================================
-- ВОДИТЕЛЬ НЕ МОЖЕТ ПИСАТЬ
-- ============================================================
-- Запись на уровне БД разрешена только офису. Проверяем, что водитель
-- получает отказ. Если отказа нет — политика на запись настроена
-- неверно, и это дыра.
do $$
begin
  begin
    insert into public.trips (id, trip_number) values
      ('99999999-9999-9999-9999-999999999999', 'T-HACK');
    raise exception 'FAIL: водитель смог вставить рейс — политика на запись не работает';
  exception
    when insufficient_privilege then
      raise notice 'ok: insert trips отклонён (нет прав)';
    when others then
      if sqlerrm like '%row-level security%' then
        raise notice 'ok: insert trips отклонён (row-level security)';
      else
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  begin
    update public.trips set status = 'hacked'
      where id = '11111111-aaaa-1111-1111-111111111111';
    raise exception 'FAIL: водитель смог обновить чужой рейс';
  exception
    when insufficient_privilege then
      raise notice 'ok: update trips отклонён (нет прав)';
    when others then
      if sqlerrm like '%row-level security%' then
        raise notice 'ok: update trips отклонён (row-level security)';
      else
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  begin
    delete from public.trip_expenses
      where id = '55555555-eeee-5555-5555-555555555555';
    raise exception 'FAIL: водитель смог удалить чужой расход';
  exception
    when insufficient_privilege then
      raise notice 'ok: delete trip_expenses отклонён (нет прав)';
    when others then
      if sqlerrm like '%row-level security%' then
        raise notice 'ok: delete trip_expenses отклонён (row-level security)';
      else
        raise;
      end if;
  end;
end;
$$;


-- ============================================================
-- ANON (до входа): ничего не видит
-- ============================================================
reset role;
set role anon;

select public.assert_count('anon: no trips', 0, 'select count(*) from public.trips');
select public.assert_count('anon: no drivers', 0, 'select count(*) from public.drivers');
select public.assert_count('anon: no users', 0, 'select count(*) from public.users');
select public.assert_count('anon: no expenses', 0, 'select count(*) from public.trip_expenses');
select public.assert_count('anon: no clients', 0, 'select count(*) from public.clients');
select public.assert_count('anon: no profiles', 0, 'select count(*) from public.profiles');

reset role;
