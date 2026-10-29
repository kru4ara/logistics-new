-- ============================================================
-- Проверка поведения RLS-политик (assertions)
-- ============================================================
-- Запускается в CI на чистом Postgres: .github/workflows/rls.yml
--
-- Проверяем не синтаксис, а ПОВЕДЕНИЕ: что дыра из фазы 31
-- (водитель видит чужой рейс) закрыта на уровне БД.
--
-- Каждая проверка — вызов assert_count: при несовпадении он бросает
-- исключение, и весь файл (psql -v ON_ERROR_STOP=1) падает -> job красный.
--
-- Роли: office (admin/manager) и driver.
--
-- Модель владения (см. миграцию 004):
--   Водитель владеет рейсом, если назначен на рейс целиком ИЛИ хотя бы
--   на один его сегмент. Отсюда ожидания ниже.
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

-- Диагностика: печатает состояние владения для текущего пользователя.
-- Нужна, чтобы при падении сразу видеть, что возвращают функции,
-- а не гадать по одной строке "ожидалось 1, получено 0".
create or replace function public.dump_ownership(p_trip_id uuid)
returns void
language plpgsql
as $$
begin
  raise notice 'diag: current_driver_id=% | owns_trip(T-1)=% | owns_trip(T-2)=%',
    public.current_driver_id(),
    public.driver_owns_trip('11111111-aaaa-1111-1111-111111111111'),
    public.driver_owns_trip('22222222-bbbb-2222-2222-222222222222');
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

insert into public.contractors (id, name) values
  ('aaaa1111-1111-1111-1111-111111111111', 'Подрядчик 1'),
  ('bbbb2222-2222-2222-2222-222222222222', 'Подрядчик 2'),
  ('cccc3333-3333-3333-3333-333333333333', 'Подрядчик 3');

insert into public.trips (id, trip_number, driver_id, client_id, status) values
  ('11111111-aaaa-1111-1111-111111111111', 'T-1', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'active'),
  ('22222222-bbbb-2222-2222-222222222222', 'T-2', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'active');

-- Сегмент 1: водитель А ведёт рейс T-1 целиком, сегмент его.
-- Сегмент 2: водитель Б назначен на СЕГМЕНТ рейса T-1 (рейс ведёт А).
--   Это ключевой кейс фазы 33: код допускает isTripOwner || isSegmentOwner,
--   значит RLS тоже должен.
-- Сегмент 3: водитель Б ведёт рейс T-2 целиком.
insert into public.trip_segments (id, trip_id, driver_id, contractor_id, position, executor_type) values
  ('33333333-cccc-3333-3333-333333333333', '11111111-aaaa-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaa1111-1111-1111-1111-111111111111', 1, 'us'),
  ('44444444-dddd-4444-4444-444444444444', '11111111-aaaa-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bbbb2222-2222-2222-2222-222222222222', 2, 'us'),
  ('55556666-eeee-5555-6666-555566667777', '22222222-bbbb-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'cccc3333-3333-3333-3333-333333333333', 1, 'us');

insert into public.trip_expenses (id, trip_id, category, amount_eur) values
  ('55555555-eeee-5555-5555-555555555555', '11111111-aaaa-1111-1111-111111111111', 'fuel', 100),
  ('66655555-ffff-6666-6666-666666666666', '22222222-bbbb-2222-2222-222222222222', 'fuel', 200);

insert into public.trip_cargo (id, trip_id, client_id, position, label) values
  ('77755555-9999-7777-7777-777777777777', '11111111-aaaa-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'Груз 1'),
  ('88855555-9999-7777-7777-777777777777', '22222222-bbbb-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 1, 'Груз 2');

insert into public.trip_documents (id, trip_id, document_type, file_path) values
  ('99955555-aaaa-9999-9999-999999999999', '11111111-aaaa-1111-1111-111111111111', 'cmr', 'a.pdf');

insert into public.driver_transactions (id, driver_id, type, amount_eur) values
  ('aaaa5555-bbbb-aaaa-bbbb-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'accrual', 500);

insert into public.documents (id, entity_type, entity_id, file_path) values
  ('bbbb5555-cccc-bbbb-cccc-bbbbbbbbbbbb', 'driver', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'passport-a.pdf');

insert into public.trucks (id, registration_number, type, logisat_enabled, logisat_device_id) values
  ('cccc5555-dddd-cccc-dddd-cccccccccccc', 'A-1', 'tractor', true, 'dev-1');

insert into public.rates (rate_date, pln_to_eur, byn_to_eur) values ('2026-01-01', 0.23, 0.28);

insert into public.reminders (id, title, entity_type, entity_id, status) values
  ('dddd5555-eeee-dddd-eeee-dddddddddddd', 'Права', 'driver', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'active');


-- ============================================================
-- ОФИС: видит всё
-- ============================================================
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- Сначала убеждаемся, что офис вообще опознан: если is_office() вернул
-- false, все офисные проверки упадут одинаково и замаскируют причину.
select public.assert_count('office: is_office() is true', 1,
  'select case when public.is_office() then 1 else 0 end');

select public.assert_count('office: trips', 2, 'select count(*) from public.trips');
select public.assert_count('office: expenses', 2, 'select count(*) from public.trip_expenses');
select public.assert_count('office: cargo', 2, 'select count(*) from public.trip_cargo');
select public.assert_count('office: drivers', 2, 'select count(*) from public.drivers');
select public.assert_count('office: clients', 2, 'select count(*) from public.clients');
select public.assert_count('office: contractors', 3, 'select count(*) from public.contractors');
select public.assert_count('office: reminders', 1, 'select count(*) from public.reminders');
select public.assert_count('office: profiles', 3, 'select count(*) from public.profiles');
select public.assert_count('office: documents', 1, 'select count(*) from public.documents');
select public.assert_count('office: driver_transactions', 1, 'select count(*) from public.driver_transactions');
select public.assert_count('office: trip_segments', 3, 'select count(*) from public.trip_segments');
select public.assert_count('office: trip_documents', 1, 'select count(*) from public.trip_documents');
select public.assert_count('office: rates', 1, 'select count(*) from public.rates');
select public.assert_count('office: trucks', 1, 'select count(*) from public.trucks');


-- ============================================================
-- ВОДИТЕЛЬ А: ведёт рейс T-1 целиком
-- ============================================================
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select public.dump_ownership(null);

select public.assert_count('driver A: own trip', 1, 'select count(*) from public.trips');
select public.assert_count('driver A: segments of own trip', 2, 'select count(*) from public.trip_segments');
select public.assert_count('driver A: own expense', 1, 'select count(*) from public.trip_expenses');
select public.assert_count('driver A: own cargo', 1, 'select count(*) from public.trip_cargo');
select public.assert_count('driver A: own trip document', 1, 'select count(*) from public.trip_documents');
select public.assert_count('driver A: own profile only', 1, 'select count(*) from public.profiles');
select public.assert_count('driver A: self in drivers', 1, 'select count(*) from public.drivers');
select public.assert_count('driver A: client of own trip', 1, 'select count(*) from public.clients');
select public.assert_count('driver A: contractors of own trip', 2, 'select count(*) from public.contractors');
select public.assert_count('driver A: own transaction', 1, 'select count(*) from public.driver_transactions');
select public.assert_count('driver A: own document', 1, 'select count(*) from public.documents');
select public.assert_count('driver A: own reminder', 1, 'select count(*) from public.reminders');
select public.assert_count('driver A: rates visible', 1, 'select count(*) from public.rates');
select public.assert_count('driver A: trucks visible', 1, 'select count(*) from public.trucks');


-- ============================================================
-- ВОДИТЕЛЬ Б: ведёт T-2 целиком + назначен на сегмент рейса T-1
-- ============================================================
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select public.dump_ownership(null);

select public.assert_count('driver B: trip via own segment + own trip', 2, 'select count(*) from public.trips');
select public.assert_count('driver B: segments of own trips', 3, 'select count(*) from public.trip_segments');
select public.assert_count('driver B: expenses of own trips', 2, 'select count(*) from public.trip_expenses');
select public.assert_count('driver B: cargo of own trips', 2, 'select count(*) from public.trip_cargo');
select public.assert_count('driver B: documents of own trips', 1, 'select count(*) from public.trip_documents');
select public.assert_count('driver B: clients of own trips', 2, 'select count(*) from public.clients');
select public.assert_count('driver B: contractors of own trips', 3, 'select count(*) from public.contractors');
select public.assert_count('driver B: NO foreign transaction', 0, 'select count(*) from public.driver_transactions');
select public.assert_count('driver B: NO foreign profile', 1, 'select count(*) from public.profiles');
select public.assert_count('driver B: NO foreign document', 0, 'select count(*) from public.documents');
select public.assert_count('driver B: NO foreign reminder', 0, 'select count(*) from public.reminders');
select public.assert_count('driver B: NO foreign driver row', 1, 'select count(*) from public.drivers');


-- ============================================================
-- ============================================================
-- ВОДИТЕЛЬ НЕ МОЖЕТ ПИСАТЬ
-- ============================================================
-- ВАЖНО про семантику RLS:
--   INSERT нарушает with_check -> БРОСАЕТСЯ ошибка (row-level security).
--   UPDATE/DELETE нарушают using -> НЕ бросают ошибку, а затрагивают
--   0 строк. Поэтому проверять надо СЧЁТОМ затронутых строк, а не
--   ожиданием исключения. Раньше тест ждал исключение от UPDATE —
--   и падал, хотя политика работала правильно.

-- insert: должен быть отклонён (with_check не проходит)
do $$
declare
  v_count integer;
begin
  begin
    insert into public.trips (id, trip_number) values
      ('99999999-9999-9999-9999-999999999999', 'T-HACK');
    v_count := 1;
  exception
    when insufficient_privilege then
      raise notice 'ok: insert trips отклонён (нет прав)';
      return;
    when others then
      if sqlerrm like '%row-level security%' then
        raise notice 'ok: insert trips отклонён (row-level security)';
        return;
      else
        raise;
      end if;
  end;
  raise exception 'FAIL: водитель смог вставить рейс — политика на запись не работает';
end;
$$;

-- update чужого рейса: должен затронуть 0 строк
do $$
declare
  v_count integer;
begin
  update public.trips set status = 'hacked'
    where id = '11111111-aaaa-1111-1111-111111111111';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: водитель обновил чужой рейс (% строк)', v_count;
  end if;
  raise notice 'ok: update чужого рейса не затронул строк';
end;
$$;

-- delete чужого расхода: должен затронуть 0 строк
do $$
declare
  v_count integer;
begin
  delete from public.trip_expenses
    where id = '55555555-eeee-5555-5555-555555555555';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: водитель удалил чужой расход (% строк)', v_count;
  end if;
  raise notice 'ok: delete чужого расхода не затронул строк';
end;
$$;

-- Запись рейсов — только для офиса (trips_office_update: is_office()).
-- Водитель не может изменить даже СВОЙ рейс. Это осознанное решение
-- текущих политик, а не дыра: тест фиксирует текущее поведение.
do $$
declare
  v_count integer;
begin
  update public.trips set status = 'active'
    where id = '11111111-aaaa-1111-1111-111111111111';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'FAIL: водитель изменил рейс, хотя запись должна быть только у офиса (% строк)', v_count;
  end if;
  raise notice 'ok: запись рейсов — только офис (водитель: 0 строк)';
end;
$$;


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
select public.assert_count('anon: no contractors', 0, 'select count(*) from public.contractors');

reset role;
