-- 034: RLS для менеджера, этап 1 — чтение справочников.
--
-- Страницы менеджера переходят на RLS-клиент (lib/supabase/scoped.ts): заказы
-- и всё, что к ним относится, база отдаёт только из его периметра (свои +
-- неназначенные). Эти выборки подтягивают водителя, точки погрузки и
-- менеджера заказа — без права читать эти справочники у менеджера
-- карточка заказа осталась бы без имён.
--
-- Справочники не секретны для менеджера: он и так видит их в разделах
-- «Водители», «Точки», а имена менеджеров — в заказах. Политики только
-- добавляются (OR к существующим), офис и водитель не затронуты.

begin;

drop policy if exists drivers_select_manager on public.drivers;
create policy drivers_select_manager on public.drivers
  for select to authenticated using (public.is_manager());

drop policy if exists locations_select_manager on public.locations;
create policy locations_select_manager on public.locations
  for select to authenticated using (public.is_manager());

drop policy if exists managers_select_manager on public.managers;
create policy managers_select_manager on public.managers
  for select to authenticated using (public.is_manager());

commit;
