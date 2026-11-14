-- Прод (smodijsjiwcvsscfgloh): миграции 000–022 применялись вручную.
-- Один раз: создать журнал и отметить их как применённые (без выполнения).
-- То же самое делает: node scripts/migrate.mjs --adopt-through 20261114_022_company_settings
-- После этого 023 и всё новое применяет scripts/migrate.mjs.
begin;
create table if not exists public.schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now(),
  adopted boolean not null default false
);

comment on table public.schema_migrations is
  'Журнал миграций (scripts/migrate.mjs). adopted = отмечена как применённая без выполнения (применялась вручную до появления журнала).';

alter table public.schema_migrations enable row level security;
revoke all on table public.schema_migrations from public, anon, authenticated;

insert into public.schema_migrations (version, checksum, adopted) values
  ('00000000_000_baseline', 'f11b4e8eaa3e1a8747b12df135937c5b2c3877ab9ad1c3fade0d036a9acf9927', true),
  ('20261029_001_rls_trips_segments_expenses', 'ccd9f4ac5770d92df0661f61b0be4e1a57d0a9e988b818466170aed9f7063897', true),
  ('20261029_002_rls_remaining_tables', '0205a0555927a827efb8d26cee285d88a9660d34a9eac3977a7365a0554a37a7', true),
  ('20261029_003_rls_driver_exceptions', 'c5e19e5f0017be3234b4343ab25f1d9f50623a25885fbaff57c086da8aeb7193', true),
  ('20261029_004_rls_driver_helper_functions', '83a6b6dc3fb345c0005a6c5cd197a2f112abab79c60393f1170b2bf995c4737e', true),
  ('20261031_001_orders_unification', '9ba5b0a22241c606688dbe89eea7fe3bce18ad206e91455faf8110765efc82e5', true),
  ('20261031_002_migrate_forwarding_to_orders', '0dd70f28c06ff467df0d3d9f5e61f4059ed9772108c0a7955280def031a7aa7b', true),
  ('20261031_003_forwarding_dates_and_route', '1c304972d830a85cd4646c3d660b291031d17edf2eee31f9ae156a5884cd3202', true),
  ('20261031_004_ordering_by_unload_date', 'fca17e51addd5bcb5b9e8ea310df5ecee139bc0a78a6e8a931a3a9d24ed80e79', true),
  ('20261101_005_numbering_by_unload_date_strict', '37784d73ceb7416b8a4fd4e0302e87d3ec0e9a1b950c13b29adaa68b8a84c82a', true),
  ('20261101_006_auto_capex_detection', '7452d7d8b2058fb6d28bcd3a156cc824d4343abe82c92e19e60e58a5067ca807', true),
  ('20261101_007_profit_mode_from_segments', '197ac0a01b61e26bce22b710e7af4e16210179b1e2cb3c603cbdc2640a96f7f5', true),
  ('20261102_008_mixed_order_is_trip', 'fff7f76e62ce9f5e73f802d0ab1d3707956d0189137b2cb6f8a1aa2bfee263f5', true),
  ('20261102_009_drop_costs_closed', 'c9c3a7758857d0b2365d6b32582acdfd7a7bbccdf23c108f1571ca0e89c27a95', true),
  ('20261107_010_plan_vs_actual_dates', '45603bbe21630d24b304af78065f8a8aefa78eb015637316eda7529f190464a7', true),
  ('20261109_011_lock_backup_tables', '3143579c9bc09a9b3f9702dac546124d5b7afb06538c01755d9358f2d4297e8c', true),
  ('20261111_012_managers', 'a8d77d7bce8e9313d0a7957cd9bbf9e2b950bd06b767866f9b201ca85b48e146', true),
  ('20261112_013_managers_role_check', 'ef29de1fee1f24828e4b6b7037b57d8d7e33bfe246c6ec506ed4a7e064661722', true),
  ('20261112_014_manager_passwords', '85d2c995c53ec8a1926eeec6c825d7da4f92fbf39727a96dc630389ef87e5a12', true),
  ('20261112_015_fix_lookup_login_email', 'a4e10978ee137643219765a2f8442877f9ad98a801a82c5e2c674b7f1e304c82', true),
  ('20261113_016_lookup_login_email_server_only', 'd174a6db5c90e5172150cb2dbf0b308917771e6141757c3b8444f4a8ab9cd0d8', true),
  ('20261113_017_driver_telegram_links', '29b66cb232af33ce6306317b0e7cc39813b620ac5889755174995b4870a00250', true),
  ('20261113_018_drop_manager_passwords', '3edeb48cfe342311591a1d823b0d216ee663c02a0a828b5a307980a84bb8c967', true),
  ('20261114_019_login_failures', '1611fb1173603af2e5f85084d7d38470446925f79bc78cf88db3aa219d3e4717', true),
  ('20261114_020_lock_dangerous_rpc', '27e3cbd48593111e70df4e195a99cdaaeae39ab63f8b8af9b4446972902486e3', true),
  ('20261114_021_private_documents_bucket', '490798cf1a55cd12c3cd8c6a984329de6134c1578fb634d7a80dc5189ac8d4bb', true),
  ('20261114_022_company_settings', '96399654564f64df6230a47bb1f7294aadb6f08cc7cf462a0c8bdff2a7aa334a', true)
on conflict (version) do nothing;

-- 023 (сам журнал) только что создан выше — тоже отметить.
insert into public.schema_migrations (version, checksum) values
  ('20261114_023_schema_migrations', '9b4cefb43a4d0b4a657c3797b3bf4bad8ba7753735dfe01e6652de5fa852111a')
on conflict (version) do nothing;
commit;

select count(*) as migrations, max(version) as latest from public.schema_migrations;
