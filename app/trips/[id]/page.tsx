import { createClient } from '../../../lib/supabase/admin';
import AddExpenseForm from '../AddExpenseForm';
import FileUpload from '../../driver/FileUpload';
import DocumentList from '../../driver/DocumentList';
import CopyBlock from '../../components/CopyBlock';
import SendTaskButton from './SendTaskButton';
import TripCargoBlock from './TripCargoBlock';
import TripSegmentsBlock from './TripSegmentsBlock';
import ExpensesList from '../ExpensesList';
import { buildRouteMap, type SegmentRouteRow } from '../../../lib/trip-route';
import { buildDriverTaskText } from '../../../lib/trip-task-text';
import TripHeader from './TripHeader';
import TripInfo from './TripInfo';
import TripEconomics from './TripEconomics';
import { getScope, applyTripScope } from '../../../lib/scope';
import {
  AlertTriangle,
  Paperclip,
  FolderOpen,
  PlusCircle,
} from 'lucide-react';
import { withSignedUrls } from '../../../lib/storage-urls';
import { getT } from '../../../lib/i18n/server';
import { tripStatusKey, TRIP_STATUSES } from '../../../lib/i18n/labels';
import { getDriverT } from '../../../lib/driver-locale';
import PaymentBlock from './PaymentBlock';
import InvoiceBlock from './InvoiceBlock';
import { getInvoiceProvider, providerById, providerInfo } from '../../../lib/invoicing';
import { ksefStateOf } from '../../../lib/invoicing/types';
import { normalizeCountry, suggestVat, suggestLang, positionName, normalizeTaxId, placeOf, vehicleNote } from '../../../lib/invoice-rules';
import type { MessageKey } from '../../../lib/i18n/translate';
import { getSessionContext } from '../../../lib/session';
import { can } from '../../../lib/roles';

export const dynamic = 'force-dynamic';
 
const NEGATIVE_FUEL_TOLERANCE = -200;

function pickName(rel: unknown): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  if (typeof rel === 'object' && 'name' in rel) {
    return (rel as { name?: string }).name;
  }
  return undefined;
}

function pickOne<T>(rel: unknown): T | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return (rel[0] as T) ?? null;
  return rel as T;
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const { role } = await getSessionContext();
  const { id: tripId } = await params;
  if (!tripId) return <div className="p-8">{t('trip.noId')}</div>;

  const supabase = await createClient();

  // Скоуп (фаза 39): менеджер не открывает чужой заказ по прямой ссылке.
  const scope = await getScope();

  const { data: trip, error: tripError } = await applyTripScope(
      supabase
        .from('trips')
        .select('*, clients(name, email, tax_id, street, post_code, city, country, payment_days), drivers!driver_id(first_name, last_name, phone_by, phone_pl, telegram_chat_id), trucks!truck_id(registration_number)'),
      scope
    )
    .eq('id', tripId)
    .single();

  if (tripError) {
    return <div className="p-8 text-red-500">{t('trip.loadError', { msg: tripError.message })}</div>;
  }

  // Имя ответственного менеджера (фаза 39).
  let managerName: string | null = null;
  if (trip.manager_id) {
    const { data: manager } = await supabase
      .from('managers')
      .select('full_name')
      .eq('id', trip.manager_id)
      .maybeSingle();
    managerName = manager?.full_name || null;
  }

  let trailerNumber: string | null = null;
  if (trip.trailer_id) {
    const { data: trailer } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', trip.trailer_id)
      .single();
    trailerNumber = trailer?.registration_number || null;
  }

  const { data: expenses } = await supabase
    .from('trip_expenses')
    .select('*')
    .eq('trip_id', tripId);

  const { data: documentRows } = await supabase
    .from('trip_documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('uploaded_at', { ascending: false });
  // Бакет закрытый: ссылки на файлы — временные, только для документов,
  // которые этот пользователь уже смог прочитать (lib/storage-urls.ts).
  const documents = await withSignedUrls(documentRows || []);

  const { data: contractors } = await supabase
    .from('contractors')
    .select('id, name, full_name, country, address, tax_id, contact_person, phone, email')
    .order('name');

  const { data: loadingLocations } = await supabase
    .from('locations')
    .select('id, name, type, country, company_name, postal_code, city, address, default_loading_number')
    .in('type', ['loading', 'both'])
    .order('name');

  const { data: unloadingLocations } = await supabase
    .from('locations')
    .select('id, name, type, country, company_name, postal_code, city, address, default_loading_number')
    .in('type', ['unloading', 'both'])
    .order('name');

  const { data: customsLocations } = await supabase
    .from('locations')
    .select('id, name, type, country, company_name, postal_code, city, address, default_loading_number')
    .in('type', ['customs', 'both'])
    .order('name');

  const { data: clientsList } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  const { data: tractorsList } = await supabase
    .from('trucks')
    .select('id, registration_number')
    .eq('type', 'tractor')
    .order('registration_number');

  const { data: trailersList } = await supabase
    .from('trucks')
    .select('id, registration_number')
    .eq('type', 'trailer')
    .order('registration_number');

  const { data: driversList } = await supabase
    .from('drivers')
    .select('id, first_name, last_name')
    .order('last_name');

  // ГРУЗЫ
  const { data: cargoRaw } = await supabase
    .from('trip_cargo')
    .select('*, clients(name)')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  const cargoList = (cargoRaw || []).map((c: any) => ({
    id: c.id,
    position: c.position,
    label: c.label,
    cargo_type: c.cargo_type,
    weight_kg: c.weight_kg,
    pallets: c.pallets ?? null,
    client_id: c.client_id,
    client_name: pickName(c.clients) || null,
    notes: c.notes,
    from_country: c.from_country,
    from_city: c.from_city,
    from_company: c.from_company,
    from_address: c.from_address,
    from_postal_code: c.from_postal_code,
    to_country: c.to_country,
    to_city: c.to_city,
    to_company: c.to_company,
    to_address: c.to_address,
    to_postal_code: c.to_postal_code,
    customs_place: c.customs_place ?? null,
    customs_country: c.customs_country ?? null,
    customs_city: c.customs_city ?? null,
    customs_postal_code: c.customs_postal_code ?? null,
    customs_address: c.customs_address ?? null,
    customs_lat: c.customs_lat ?? null,
    customs_lng: c.customs_lng ?? null,
    freight_amount: c.freight_amount != null ? Number(c.freight_amount) : null,
    freight_currency: c.freight_currency ?? null,
  }));

  // УЧАСТКИ
  const { data: segmentsRaw } = await supabase
    .from('trip_segments')
    .select('*, contractors(name), trucks!truck_id(registration_number), trailers:trucks!trailer_id(registration_number), drivers!driver_id(first_name, last_name)')
    .eq('trip_id', tripId)
    .order('position', { ascending: true });

  const segmentIds = (segmentsRaw || []).map((s: any) => s.id);
  const segmentCargoRes = segmentIds.length > 0
    ? await supabase
        .from('trip_segment_cargo')
        .select('segment_id, cargo_id, trip_cargo(position, label)')
        .in('segment_id', segmentIds)
    : { data: [] };

  const cargoLinksBySegment: Record<string, { cargo_id: string; position: number; label: string }[]> = {};
  (segmentCargoRes.data || []).forEach((sc: any) => {
    if (!sc.segment_id || !sc.cargo_id) return;
    const meta = pickOne<{ position: number; label: string | null }>(sc.trip_cargo);
    if (!cargoLinksBySegment[sc.segment_id]) cargoLinksBySegment[sc.segment_id] = [];
    cargoLinksBySegment[sc.segment_id].push({
      cargo_id: sc.cargo_id,
      position: meta?.position || 0,
      label: meta?.label || '—',
    });
  });

  const segments = (segmentsRaw || []).map((s: any) => {
    const truck = pickOne<{ registration_number: string | null }>(s.trucks);
    const trailer = pickOne<{ registration_number: string | null }>(s.trailers);
    const driver = pickOne<{ first_name: string | null; last_name: string | null }>(s.drivers);
    const driverName = driver
      ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || null
      : null;
    return {
      id: s.id,
      trip_id: s.trip_id,
      position: s.position,
      executor_type: s.executor_type,
      contractor_id: s.contractor_id,
      contractor_name: pickName(s.contractors) || null,
      truck_id: s.truck_id,
      truck_reg: truck?.registration_number || null,
      trailer_id: s.trailer_id,
      trailer_reg: trailer?.registration_number || null,
      driver_id: s.driver_id,
      driver_name: driverName,
      date_from: s.date_from,
      date_to: s.date_to,
      notes: s.notes,
      price: s.price != null ? Number(s.price) : null,
      currency: s.currency,
      from_country: s.from_country,
      from_city: s.from_city,
      from_company: s.from_company,
      from_address: s.from_address,
      from_postal_code: s.from_postal_code,
      to_country: s.to_country,
      to_city: s.to_city,
      to_company: s.to_company,
      to_address: s.to_address,
      to_postal_code: s.to_postal_code,
      contractor_truck_number: s.contractor_truck_number,
      contractor_driver_name: s.contractor_driver_name,
      contractor_payment_days: s.contractor_payment_days,
      contractor_payment_document_type: s.contractor_payment_document_type,
      contractor_transport_type: s.contractor_transport_type,
      contractor_transport_temperature: s.contractor_transport_temperature,
      stops: Array.isArray(s.stops) ? s.stops : [],
      cargoLinks: cargoLinksBySegment[s.id] || [],
    };
  });

  const routeMap = buildRouteMap((segmentsRaw || []) as SegmentRouteRow[]);
  const computedRoute = routeMap.get(tripId)?.route ?? '—';

  // Расчёты
  // Подрядчик — из расходов категории 'contractor'. Эта же сумма лежит
  // в trip_segments.price, но в расходах она уже создаётся автоматически
  // из сегмента, поэтому сегменты здесь НЕ суммируются —
  // иначе подрядчик вычтется дважды.
  const contractorExpenses = expenses
    ?.filter((e: any) => e.category === 'contractor')
    .reduce((sum: number, e: any) => sum + (e.amount_eur || 0), 0) || 0;

  const otherExpenses = expenses
    ?.filter((e: any) => e.category !== 'contractor')
    .reduce((sum: number, e: any) => sum + (e.amount_eur || 0), 0) || 0;

  const totalExpenses = contractorExpenses + otherExpenses;
  const profit = (trip.revenue_eur || 0) - totalExpenses;

  const refuelLiters = expenses?.filter((e: any) => e.category === 'fuel' && e.liters).reduce((sum: number, e: any) => sum + e.liters, 0) || 0;
  const fuelLeft = (trip.start_fuel_level || 0) + refuelLiters - (trip.actual_liters || 0);

  const fuelLeftIsNegative = fuelLeft < 0;
  const fuelLeftIsCritical = fuelLeft < NEGATIVE_FUEL_TOLERANCE;

  const driver = pickOne<{ first_name: string | null; last_name: string | null; phone_by: string | null; phone_pl: string | null; telegram_chat_id: string | null }>(trip.drivers);
  const truck = pickOne<{ registration_number: string | null }>(trip.trucks);

  const hasSalaryExpense = (expenses || []).some((e: any) => e.category === 'salary');
  const needsSalary = trip.status === 'completed' && Boolean(driver) && !hasSalaryExpense;

  const { t: driverT } = await getDriverT(trip.driver_id);
  const taskText = buildDriverTaskText({
    trip: {
      ...trip,
      clients: { name: pickName(trip.clients) || null },
      id: tripId,
    },
    driver,
    truck,
    trailerNumber,
    segments: segments as any,
    markdown: false,
    t: driverT,
  });

  const driverHasTelegram = Boolean(driver?.telegram_chat_id);
  const sendDisabled = !driver || !driverHasTelegram;
  const sendHint = !driver
    ? t('trip.sendNoDriver')
    : !driverHasTelegram
      ? t('trip.sendNoTelegram', { name: `${driver.first_name} ${driver.last_name}` })
      : undefined;

  const statusLabels: Record<string, string> = Object.fromEntries(
    TRIP_STATUSES.map((s) => [s, t(tripStatusKey(s)!)])
  );

  const statusColors: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-brand-50 text-brand-700 border-brand-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    invoiced: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  // Фактура (сервис фактур компании → KSeF): офис, заказ завершён или уже со счётом.
  let invoiceBlock: React.ReactNode = null;
  let invoiceForm = false;
  if (can(role, 'receivables.edit') && ['active', 'completed', 'invoiced', 'paid'].includes(trip.status)
      && (trip.invoice_external_id || trip.status !== 'paid')) {
    const cl = pickOne<{ name: string; tax_id: string | null; street: string | null; city: string | null;
      country: string | null; payment_days: number | null }>(trip.clients);
    const country = normalizeCountry(cl?.country);
    const vat = suggestVat(country);
    const missing: MessageKey[] = [];
    if (cl && !normalizeTaxId(cl.tax_id, country)) missing.push('inv.missTaxId');
    if (cl && (!cl.street || !cl.city)) missing.push('inv.missAddress');
    if (cl && !country) missing.push('inv.missCountry');
    const firstSeg = segments[0];
    const lastSeg = segments[segments.length - 1];
    const todayStr = new Date().toISOString().slice(0, 10);
    const sell = (trip.unload_date || (trip.end_date ? String(trip.end_date).slice(0, 10) : null) || todayStr) as string;
    const provider = trip.invoice_external_id ? providerById(trip.invoice_provider) : getInvoiceProvider();
    let issued: { invoiceNumber: string | null; ksefStatus: string | null; ksefNumber: string | null; ksefError: string | null } | null =
      trip.invoice_external_id
        ? { invoiceNumber: trip.invoice_number ?? null, ksefStatus: trip.ksef_status ?? null, ksefNumber: trip.ksef_number ?? null, ksefError: trip.ksef_error ?? null }
        : null;
    // Ждём номер KSeF — спросим сервис фактур сразу при открытии (не дольше 5 с, сбой не мешает странице).
    const waiting = ['pending', 'processing'].includes(ksefStateOf(trip.ksef_status));
    if (issued && provider && waiting) {
      const snap = await Promise.race([
        provider.refresh(trip.invoice_external_id as string).catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), 5000)),
      ]);
      if (snap) {
        const fields = {
          ...(snap.number ? { invoice_number: snap.number } : {}),
          ksef_status: snap.ksef === 'none' ? null : snap.ksef,
          ksef_number: snap.ksefNumber,
          ksef_error: snap.ksefError,
        };
        await supabase.from('trips').update(fields).eq('id', tripId);
        issued = {
          invoiceNumber: snap.number ?? issued.invoiceNumber,
          ksefStatus: fields.ksef_status,
          ksefNumber: snap.ksefNumber,
          ksefError: snap.ksefError,
        };
      }
    }
    // Форма есть (даже если в карточке клиента чего-то не хватает — она подскажет, чего).
    invoiceForm = Boolean(provider && !issued);
    invoiceBlock = (
      <InvoiceBlock
        tripId={tripId}
        provider={provider ? providerInfo(provider) : null}
        issued={issued}
        defaults={{
          issueDate: todayStr,
          sellDate: sell,
          paymentDays: cl?.payment_days ?? 30,
          netAmount: trip.revenue_eur != null ? Number(trip.revenue_eur) : null,
          tax: vat.tax,
          npKind: vat.npKind,
          reverseCharge: vat.reverseCharge,
          lang: suggestLang(country),
          positionName: positionName({
            requestNo: trip.client_request_number ?? null,
            tripNumber: trip.trip_number != null ? String(trip.trip_number) : null,
            load: placeOf(firstSeg?.from_city, firstSeg?.from_country),
            unload: placeOf(lastSeg?.to_city, lastSeg?.to_country),
          }),
          note: vehicleNote(segments.map((sg) => ({
            truck: sg.truck_reg, trailer: sg.trailer_reg, contractorTruck: sg.contractor_truck_number ?? null,
          }))),
        }}
        clientId={trip.client_id ?? null}
        clientName={cl?.name ?? null}
        clientMissing={cl ? missing : ['inv.missClient']}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <TripHeader
          tripId={tripId}
          trip={trip}
          driver={driver}
          trailerNumber={trailerNumber}
          fuelLeft={fuelLeft}
          fuelLeftIsNegative={fuelLeftIsNegative}
          fuelLeftIsCritical={fuelLeftIsCritical}
          statusLabels={statusLabels}
          statusColors={statusColors}
          invoiceForm={invoiceForm}
        />

        {needsSalary && (
          <div className="card border-l-4 border-l-amber-500 bg-amber-50/40 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={2.2} />
              <div className="min-w-0">
                <div className="font-bold text-amber-900 text-sm md:text-base">
                  {t('trip.salaryTitle')}
                </div>
                <div className="text-xs md:text-sm text-amber-800 mt-1">
                  {t('trip.salaryA')} <b>«💶 {t('expenseCat.salary')}»</b> {t('trip.salaryB')}{' '}
                  <b>«{t('trip.addExpense')}»</b> {t('trip.salaryC', { status: t('status.active') })}
                </div>
              </div>
            </div>
          </div>
        )}

        <TripInfo
          tripId={tripId}
          trip={trip}
          driver={driver}
          truck={truck}
          trailerNumber={trailerNumber}
          computedRoute={computedRoute}
          managerName={managerName}
        />

        <TripCargoBlock
          tripId={tripId}
          cargoList={cargoList}
          clients={(clientsList || []).map((c) => ({ id: c.id, label: c.name }))}
          loadingLocations={(loadingLocations || []) as any}
          unloadingLocations={(unloadingLocations || []) as any}
          customsLocations={(customsLocations || []) as any}
          defaultClientId={trip.client_id}
        />

        <TripSegmentsBlock
          tripId={tripId}
          segments={segments as any}
          contractors={(contractors || []).map((c) => ({ id: c.id, label: c.name }))}
          trucks={(tractorsList || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          trailers={(trailersList || []).map((t) => ({ id: t.id, label: t.registration_number }))}
          drivers={(driversList || []).map((d) => ({ id: d.id, label: `${d.first_name} ${d.last_name}` }))}
          loadingLocations={(loadingLocations || []) as any}
          unloadingLocations={(unloadingLocations || []) as any}
          customsLocations={(customsLocations || []) as any}
          cargoList={cargoList.map((c) => ({
            id: c.id,
            position: c.position,
            label: c.label || '—',
            from_country: c.from_country,
            from_city: c.from_city,
            from_company: c.from_company,
            from_address: c.from_address,
            from_postal_code: c.from_postal_code,
            to_country: c.to_country,
            to_city: c.to_city,
            to_company: c.to_company,
            to_address: c.to_address,
            to_postal_code: c.to_postal_code,
          }))}
        />

        <div className="space-y-3">
          <CopyBlock text={taskText} phone={driver?.phone_by || driver?.phone_pl} />
          <div className="card p-5 md:p-6">
            <SendTaskButton tripId={tripId} disabled={sendDisabled} disabledHint={sendHint} />
          </div>
        </div>

        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-brand-600" strokeWidth={2} />
            {t('trip.uploadDocs')}
          </h2>
          <FileUpload tripId={tripId} />
        </div>

        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-brand-600" strokeWidth={2} />
            {t('trip.uploadedFiles')}
          </h2>
          <DocumentList documents={documents || []} tripId={tripId} canDelete={true} />
        </div>

        <ExpensesList
          expenses={expenses || []}
          segments={segments}
          tripId={tripId}
          totalExpenses={totalExpenses}
        />

        <TripEconomics
          trip={trip}
          contractorExpenses={contractorExpenses}
          otherExpenses={otherExpenses}
          profit={profit}
        />

        {invoiceBlock}

        {can(role, 'receivables.edit') && ['invoiced', 'paid'].includes(trip.status) && (
          <PaymentBlock
            tripId={tripId}
            invoiceNumber={trip.invoice_number ?? null}
            invoicedAt={trip.invoiced_at ?? null}
            paymentDue={trip.payment_due ?? null}
            paidAt={trip.paid_at ?? null}
          />
        )}

        <div className="card p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-brand-600" strokeWidth={2} />
            {t('trip.addExpense')}
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            {t('trip.addExpenseHint')}
          </p>
          <AddExpenseForm
            tripId={tripId}
            hasDriver={Boolean(driver)}
            driverName={driver ? `${driver.first_name} ${driver.last_name}` : null}
            allowSalary={true}
          />
        </div>

      </div>
    </main>
  );
}
