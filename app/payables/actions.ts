'use server';

import { revalidatePath } from 'next/cache';
import { requireCapability } from '../../lib/require-office';
import { createClient } from '../../lib/supabase/admin';
import { logAudit } from '../../lib/audit';
import { getT } from '../../lib/i18n/server';
import { runKsefPurchaseSync } from '../../lib/payables/sync';
import { recalcSegmentCost } from '../../lib/payables/cost';
import { parseManualInvoice, costAmount } from '../../lib/payables/cost-rules';
import { invoiceKey, isValidPaidDate } from '../../lib/payables/duplicate-rules';
import { syncInvoiceTripExpense } from '../../lib/payables/trip-expense';
import { syncInvoiceOverheadCost } from '../../lib/payables/overhead-cost';
import { isMonthClosed, tripMonth } from '../../lib/closed-months';
import { EXPENSE_CATEGORIES } from '../../lib/i18n/labels';
import { validateAllocations, findManualOverlaps, NOT_DOUBLE_KEY, type Allocation, type ManualExpense } from '../../lib/payables/trip-rules';
import type { MessageKey } from '../../lib/i18n/translate';
import { isOverheadCategory, sellerKey } from '../../lib/payables/overhead-rules';
import { fetchAll } from '../../lib/fetch-all';

type Result = { ok: boolean; message?: string };
/** Ручные расходы рейсов, которые повторяет счёт: спросить, заменить ли их. */
export type ManualConflict = { id: string; trip: string; text: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Рейс, к которому счёт привязан как расход. */
async function invoiceTripId(supabase: Supabase, invoiceId: string): Promise<string | null> {
  const { data, error } = await supabase.from('purchase_invoices').select('trip_id').eq('id', invoiceId).maybeSingle();
  return error ? null : ((data?.trip_id as string | null) ?? null);
}

/** Снять привязку счёта к рейсу-расходу (перед привязкой к участку, «не относится», отвязкой). */
async function detachFromTrip(supabase: Supabase, invoiceId: string, tripId: string | null): Promise<void> {
  if (!tripId) return;
  await supabase.from('purchase_invoices').update({ trip_id: null }).eq('id', invoiceId);
  await syncInvoiceTripExpense(supabase, invoiceId);
  revalidatePath(`/trips/${tripId}`);
}

/** Загрузить входящие фактуры из KSeF сейчас (то же делает cron ночью). */
export async function syncPurchasesNow(since?: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) return { ok: false, message: t('pay.errDate') };
  const r = await runKsefPurchaseSync(since ? { since } : {});
  revalidatePath('/payables');
  if (!r.ok) {
    return { ok: false, message: r.reason === 'notConfigured' ? t('pay.notConfigured') : t('pay.syncError', { msg: r.message ?? '' }) };
  }
  return {
    ok: true,
    message:
      t('pay.syncDone', { downloaded: r.downloaded, matched: r.matched }) +
      (r.remaining > 0 ? ' ' + t('pay.syncRemaining', { n: r.remaining }) : ''),
  };
}

/** Привязать счёт к участку (segmentId) или отметить «не относится к рейсам» (null). */
export async function linkPurchase(invoiceId: string, segmentId: string | null): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_number, ksef_number, segment_id')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, message: t('pay.notFound') };
  const previousSegment = inv.segment_id as string | null;

  let seg: { id: string; trip_id: string; position: number; contractor_id: string | null } | null = null;
  if (segmentId) {
    const { data } = await supabase
      .from('trip_segments')
      .select('id, trip_id, position, contractor_id')
      .eq('id', segmentId)
      .eq('executor_type', 'contractor')
      .maybeSingle();
    if (!data) return { ok: false, message: t('pay.segmentNotFound') };
    seg = data;
  }

  const { error } = await supabase
    .from('purchase_invoices')
    .update({
      segment_id: seg?.id ?? null,
      match_status: seg ? 'manual' : 'ignored',
      ...(seg?.contractor_id ? { contractor_id: seg.contractor_id } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  await detachFromTrip(supabase, invoiceId, await invoiceTripId(supabase, invoiceId));
  await syncInvoiceOverheadCost(supabase, invoiceId);
  revalidatePath('/fixed-costs');

  // Факт стоимости — по счетам: пересчитать и прежний участок, и новый.
  if (previousSegment && previousSegment !== seg?.id) await recalcSegmentCost(supabase, previousSegment);
  if (seg) await recalcSegmentCost(supabase, seg.id);

  if (seg) {
    await logAudit({
      entity_type: 'trip',
      entity_id: seg.trip_id,
      action: 'update',
      changes: { purchase_invoice: { before: null, after: inv.invoice_number } },
      summary: `Счёт подрядчика ${inv.invoice_number ?? inv.ksef_number} привязан к участку ${seg.position}`,
    });
    revalidatePath(`/trips/${seg.trip_id}`);
  }
  revalidatePath('/payables');
  return { ok: true };
}

/** Вернуть счёт в «требуют привязки». */
export async function unlinkPurchase(invoiceId: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: before } = await supabase.from('purchase_invoices').select('segment_id, trip_segments(trip_id)').eq('id', invoiceId).maybeSingle();
  const { error } = await supabase
    .from('purchase_invoices')
    .update({ segment_id: null, match_status: 'none', updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  await detachFromTrip(supabase, invoiceId, await invoiceTripId(supabase, invoiceId));
  await syncInvoiceOverheadCost(supabase, invoiceId);
  revalidatePath('/fixed-costs');
  if (before?.segment_id) {
    await recalcSegmentCost(supabase, before.segment_id as string);
    const tripId = (Array.isArray(before.trip_segments) ? before.trip_segments[0] : before.trip_segments as any)?.trip_id;
    if (tripId) revalidatePath(`/trips/${tripId}`);
  }
  revalidatePath('/payables');
  return { ok: true };
}

const TRIP_CATEGORIES = new Set<string>(EXPENSE_CATEGORIES.map((c) => c.value));

/**
 * Привязать счёт к рейсу целиком как расход (перегруз, EX-1, EPI, склад), а не к участку
 * перевозчика. Расход появляется в рейсе обычной строкой с выбранной категорией.
 */
export async function linkPurchaseToTrip(invoiceId: string, tripId: string, category: string, manual?: 'replace' | 'keep'): Promise<Result & { conflicts?: ManualConflict[] }> {
  return linkPurchaseToTrips(invoiceId, [{ tripId, amount: NaN }], category, manual);
}

/**
 * Один счёт на несколько рейсов (месячный счёт агентства): доли по рейсам, в сумме —
 * нетто счёта. Одна доля с amount NaN — весь счёт на один рейс.
 */
export async function linkPurchaseToTrips(
  invoiceId: string,
  allocations: Allocation[],
  category: string,
  manual?: 'replace' | 'keep',
): Promise<Result & { conflicts?: ManualConflict[] }> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  if (!TRIP_CATEGORIES.has(category)) return { ok: false, message: t('payx2.errCategory') };
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, invoice_number, ksef_number, seller_name, segment_id, net_amount, gross_amount')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, message: t('pay.notFound') };
  const total = costAmount({
    net: inv.net_amount != null ? Number(inv.net_amount) : null,
    gross: inv.gross_amount != null ? Number(inv.gross_amount) : null,
  }) ?? 0;
  const single = allocations.length === 1 && Number.isNaN(allocations[0].amount);
  const allocs: Allocation[] = single ? [{ tripId: allocations[0].tripId, amount: total }] : allocations.map((a) => ({ tripId: String(a.tripId), amount: Number(a.amount) }));
  const bad = single ? null : validateAllocations(total, allocs);
  if (bad) return { ok: false, message: t(`payx4.err_${bad}` as MessageKey, { total: String(total) }) };

  const tripIds = allocs.map((a) => a.tripId);
  const { data: trips } = await supabase.from('trips').select('id, trip_number, start_date, end_date').in('id', tripIds);
  if ((trips ?? []).length !== tripIds.length) return { ok: false, message: t('payx2.errTrip') };
  // Закрытые месяцы — и новых рейсов, и тех, от которых счёт уходит.
  const { data: prevRows } = await supabase.from('trip_expenses').select('trip_id').eq('purchase_invoice_id', invoiceId);
  const prevIds = [...new Set(((prevRows ?? []) as { trip_id: string }[]).map((r) => r.trip_id))];
  const legacy = await invoiceTripId(supabase, invoiceId);
  const leaving = [...new Set([...prevIds, ...(legacy ? [legacy] : [])])].filter((id) => !tripIds.includes(id));
  const { data: leavingTrips } = leaving.length ? await supabase.from('trips').select('start_date, end_date').in('id', leaving) : { data: [] };
  for (const tr of [...(trips ?? []), ...(leavingTrips ?? [])] as { start_date: string | null; end_date: string | null }[]) {
    if (await isMonthClosed(supabase, tripMonth(tr))) return { ok: false, message: t('payx2.errClosed') };
  }

  // Расход могли уже внести в рейс руками (EPI 25 €) — без вопроса получится задвоение.
  const { data: manualRows } = await supabase
    .from('trip_expenses')
    .select('id, trip_id, category, description, original_amount, currency')
    .in('trip_id', tripIds)
    .is('purchase_invoice_id', null);
  const overlaps = findManualOverlaps((manualRows ?? []) as ManualExpense[], tripIds, category, inv.seller_name, inv.invoice_number);
  if (overlaps.length && manual !== 'replace' && manual !== 'keep') {
    const num = new Map((trips ?? []).map((x) => [x.id as string, String(x.trip_number ?? '—')]));
    const rows = (manualRows ?? []) as (ManualExpense & { original_amount: number | null; currency: string | null })[];
    return {
      ok: false,
      conflicts: overlaps.map((o) => {
        const r = rows.find((x) => x.id === o.id);
        return { id: o.id, trip: num.get(o.trip_id) ?? '—', text: [o.description || o.category, r?.original_amount != null ? `${r.original_amount} ${r.currency ?? ''}`.trim() : null].filter(Boolean).join(' · ') };
      }),
    };
  }

  const { error } = await supabase
    .from('purchase_invoices')
    .update({ trip_id: tripIds[0], segment_id: null, match_status: 'manual', updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
  if (error) {
    return { ok: false, message: /trip_id/.test(error.message) ? t('pay.needMigration') : t('dir.updateError', { msg: error.message }) };
  }
  if (inv.segment_id) await recalcSegmentCost(supabase, inv.segment_id as string);
  const synced = await syncInvoiceTripExpense(supabase, invoiceId, category, allocs);
  if (!synced.ok) {
    return { ok: false, message: synced.error === 'migration' ? t('pay.needMigration') : t('dir.updateError', { msg: synced.error ?? '' }) };
  }
  await syncInvoiceOverheadCost(supabase, invoiceId);
  if (manual === 'replace' && overlaps.length) {
    await supabase.from('trip_expenses').delete().in('id', overlaps.map((o) => o.id)).is('purchase_invoice_id', null);
  }

  const numbers = (trips ?? []).map((x) => x.trip_number ?? '').join(', ');
  await logAudit({
    entity_type: 'purchase_invoice',
    entity_id: invoiceId,
    action: 'update',
    changes: {
      trips: { before: prevIds.length ? prevIds.join(', ') : null, after: tripIds.join(', ') },
      category: { before: null, after: category },
      ...(manual === 'replace' && overlaps.length ? { manual_replaced: { before: overlaps.map((o) => o.id).join(', '), after: null } } : {}),
    },
    summary: allocs.length > 1
      ? `Счёт ${inv.invoice_number ?? inv.ksef_number ?? ''} (${inv.seller_name ?? ''}) разделён на ${allocs.length} рейсов: ${numbers}`
      : `Счёт ${inv.invoice_number ?? inv.ksef_number ?? ''} (${inv.seller_name ?? ''}) привязан к рейсу ${numbers} как расход`,
  });
  for (const id of new Set([...tripIds, ...leaving])) revalidatePath(`/trips/${id}`);
  revalidatePath('/payables');
  revalidatePath('/fixed-costs');
  return { ok: true };
}

/**
 * Разобрать счета одного продавца из «не относится к рейсам»:
 * 'trip' — вернуть все в «требуют привязки» (это расходы рейсов: EX-1, EPI…);
 * 'overhead' — категория накладных всем его счетам. С NIP запоминаем правило: новые
 * счета этого продавца при загрузке из KSeF разнесутся так же.
 */
export async function classifySeller(key: string, assignment: 'trip' | 'overhead', category?: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  if (assignment === 'overhead' && !isOverheadCategory(category)) return { ok: false, message: t('payx3.errCategory') };
  if (assignment !== 'trip' && assignment !== 'overhead') return { ok: false, message: t('payx3.errCategory') };
  const supabase = await createClient();
  const { data, error: readErr } = await fetchAll(
    supabase.from('purchase_invoices').select('id, seller_nip, seller_name').eq('match_status', 'ignored').order('id'),
  );
  if (readErr) return { ok: false, message: t('dir.updateError', { msg: readErr.message }) };
  const ids = ((data ?? []) as { id: string; seller_nip: string | null; seller_name: string | null }[])
    .filter((r) => sellerKey(r) === key)
    .map((r) => r.id);
  if (!ids.length) return { ok: false, message: t('pay.notFound') };

  const patch =
    assignment === 'trip'
      ? { match_status: 'none', overhead_category: null, updated_at: new Date().toISOString() }
      : { overhead_category: category, updated_at: new Date().toISOString() };
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('purchase_invoices').update(patch).in('id', ids.slice(i, i + 200));
    if (error) {
      return { ok: false, message: /overhead_category/.test(error.message) ? t('pay.needMigration') : t('dir.updateError', { msg: error.message }) };
    }
  }
  for (const id of ids) await syncInvoiceOverheadCost(supabase, id);
  revalidatePath('/fixed-costs');
  if (!key.startsWith('name:')) {
    await supabase
      .from('purchase_seller_rules')
      .upsert({ seller_nip: key, assignment, category: assignment === 'overhead' ? category : null, updated_at: new Date().toISOString() });
  }
  const name = ((data ?? []) as { id: string; seller_name: string | null }[]).find((r) => r.id === ids[0])?.seller_name ?? key;
  await logAudit({
    entity_type: 'purchase_invoice',
    entity_id: ids[0],
    action: 'update',
    changes: { assignment: { before: 'ignored', after: assignment === 'trip' ? 'trip' : category ?? null }, count: { before: null, after: ids.length } },
    summary: assignment === 'trip'
      ? `Счета ${name} (${ids.length}) возвращены в привязку к рейсам`
      : `Счета ${name} (${ids.length}) — накладные: ${category}`,
  });
  revalidatePath('/payables');
  return { ok: true, message: assignment === 'trip' ? t('payx3.movedToTrips', { n: ids.length }) : undefined };
}

/** Категория накладных одного счёта (уточнить внутри группы: например, e-TOLL у Logisat). */
export async function setInvoiceOverhead(invoiceId: string, category: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  if (!isOverheadCategory(category)) return { ok: false, message: t('payx3.errCategory') };
  const supabase = await createClient();
  const { data: before } = await supabase.from('purchase_invoices').select('overhead_category, invoice_number, match_status').eq('id', invoiceId).maybeSingle();
  if (!before) return { ok: false, message: t('pay.notFound') };
  if (before.match_status !== 'ignored') return { ok: false, message: t('payx3.errNotOverhead') };
  const { error } = await supabase.from('purchase_invoices').update({ overhead_category: category, updated_at: new Date().toISOString() }).eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  await syncInvoiceOverheadCost(supabase, invoiceId);
  revalidatePath('/fixed-costs');
  await logAudit({
    entity_type: 'purchase_invoice',
    entity_id: invoiceId,
    action: 'update',
    changes: { overhead_category: { before: before.overhead_category ?? null, after: category } },
    summary: `Счёт ${before.invoice_number ?? ''} — накладные: ${category}`,
  });
  revalidatePath('/payables');
  return { ok: true };
}

/**
 * Отметить оплату счёта подрядчика (или снять). date — день оплаты по выписке
 * (YYYY-MM-DD, не в будущем); без даты — сегодня. Повторный вызов с датой — исправить дату.
 */
export async function setPurchasePaid(invoiceId: string, paid: boolean, date?: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const today = new Date().toISOString().slice(0, 10);
  const paidAt = paid ? date || today : null;
  if (paidAt && !isValidPaidDate(paidAt, today)) return { ok: false, message: t('payx.errPaidDate') };
  const supabase = await createClient();
  const { data: before } = await supabase.from('purchase_invoices').select('paid_at').eq('id', invoiceId).maybeSingle();
  if (!before) return { ok: false, message: t('pay.notFound') };
  const { data, error } = await supabase
    .from('purchase_invoices')
    .update({ paid_at: paidAt, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select('invoice_number, seller_name')
    .maybeSingle();
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (!data) return { ok: false, message: t('pay.notFound') };
  await logAudit({
    entity_type: 'purchase_invoice',
    entity_id: invoiceId,
    action: 'update',
    changes: { paid_at: { before: before.paid_at ?? null, after: paidAt } },
    summary: `Счёт подрядчика ${data.invoice_number ?? ''} (${data.seller_name ?? ''}) — ${paidAt ? `оплачен ${paidAt}` : 'оплата снята'}`,
  });
  revalidatePath('/payables');
  return { ok: true };
}

const MANUAL_ERR = {
  number: 'pay.errNumber',
  date: 'pay.errDate',
  amount: 'pay.errAmount',
  currency: 'pay.errCurrency',
  due: 'pay.errDue',
} as const;

// Vercel принимает запрос до 4,5 МБ — файл до 4 МБ.
const MAX_FILE = 4 * 1024 * 1024;
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Внести счёт подрядчика вручную (иностранный перевозчик, PDF по email) — к участку рейса. */
export async function addManualPurchase(fd: FormData): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const segmentId = String(fd.get('segment_id') ?? '');
  const parsed = parseManualInvoice((k) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : null));
  if (typeof parsed === 'string') return { ok: false, message: t(MANUAL_ERR[parsed]) };

  const supabase = await createClient();
  // Без участка — счёт не из KSeF (иностранное агентство EX-1, IMEX): попадёт в «Требуют
  // привязки», где его относят к участку экспедиции или расходам нашего рейса.
  const standalone = !segmentId;
  const { data: seg } = standalone
    ? { data: null }
    : await supabase
        .from('trip_segments')
        .select('id, trip_id, position, contractor_id, contractor_payment_days, contractors(name, tax_id)')
        .eq('id', segmentId)
        .eq('executor_type', 'contractor')
        .maybeSingle();
  if (!standalone && !seg) return { ok: false, message: t('pay.segmentNotFound') };
  const sellerName = String(fd.get('seller_name') ?? '').trim().slice(0, 200);
  const sellerNip = String(fd.get('seller_nip') ?? '').trim().replace(/\s/g, '').slice(0, 30) || null;
  if (standalone && !sellerName) return { ok: false, message: t('payx5.errSeller') };
  const contractor = seg
    ? ((Array.isArray(seg.contractors) ? seg.contractors[0] : seg.contractors) as { name: string; tax_id: string | null } | null)
    : { name: sellerName, tax_id: sellerNip };

  const file = fd.get('file');
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && (file.size > MAX_FILE || !FILE_TYPES.includes(file.type))) return { ok: false, message: t('pay.errFile') };

  // Тот же счёт уже пришёл из KSeF — второй раз не вносим (иначе расход рейса удвоится).
  const key = invoiceKey(contractor?.tax_id, parsed.invoiceNumber);
  if (key) {
    const { data: same } = await supabase
      .from('purchase_invoices')
      .select('seller_nip, invoice_number')
      .eq('source', 'ksef')
      .ilike('invoice_number', parsed.invoiceNumber.trim());
    if ((same ?? []).some((x) => invoiceKey(x.seller_nip, x.invoice_number) === key)) {
      return { ok: false, message: t('payx.errKsefExists') };
    }
  }

  const days = Number(seg?.contractor_payment_days ?? 30);
  const due = parsed.paymentDue ?? new Date(Date.parse(parsed.issueDate) + (Number.isFinite(days) ? days : 30) * 86_400_000).toISOString().slice(0, 10);

  const { data: created, error } = await supabase
    .from('purchase_invoices')
    .insert({
      source: 'manual',
      ksef_number: null,
      invoice_number: parsed.invoiceNumber,
      issue_date: parsed.issueDate,
      seller_name: contractor?.name ?? null,
      seller_nip: contractor?.tax_id ?? null,
      net_amount: parsed.net,
      vat_amount: Math.round((parsed.gross - parsed.net) * 100) / 100,
      gross_amount: parsed.gross,
      currency: parsed.currency,
      payment_due: due,
      contractor_id: seg?.contractor_id ?? null,
      segment_id: seg?.id ?? null,
      match_status: seg ? 'manual' : 'none',
    })
    .select('id')
    .single();
  if (error) {
    return { ok: false, message: /duplicate key/i.test(error.message) ? t('pay.errDuplicate') : t('dir.addError', { msg: error.message }) };
  }

  if (hasFile) {
    const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-80);
    const path = `purchase_invoices/${created.id}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage
      .from('documents')
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (upErr) {
      await supabase.from('purchase_invoices').delete().eq('id', created.id);
      return { ok: false, message: t('pay.errUpload', { msg: upErr.message }) };
    }
    await supabase.from('purchase_invoices').update({ file_path: path }).eq('id', created.id);
  }

  if (seg) {
    await recalcSegmentCost(supabase, seg.id);
    await logAudit({
      entity_type: 'trip',
      entity_id: seg.trip_id,
      action: 'update',
      changes: { purchase_invoice: { before: null, after: parsed.invoiceNumber } },
      summary: `Внесён счёт подрядчика ${parsed.invoiceNumber} (${contractor?.name ?? ''}) к участку ${seg.position}: ${parsed.net} ${parsed.currency} нетто`,
    });
    revalidatePath(`/trips/${seg.trip_id}`);
  } else {
    await logAudit({
      entity_type: 'purchase_invoice',
      entity_id: created.id,
      action: 'create',
      changes: { purchase_invoice: { before: null, after: parsed.invoiceNumber } },
      summary: `Внесён счёт ${parsed.invoiceNumber} (${sellerName}) вручную, без привязки: ${parsed.gross} ${parsed.currency} брутто`,
    });
  }
  revalidatePath('/payables');
  return { ok: true };
}

/** Удалить внесённый вручную счёт (из KSeF — нельзя: только отвязать). */
export async function deleteManualPurchase(invoiceId: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: inv } = await supabase
    .from('purchase_invoices')
    .select('id, source, file_path, segment_id, invoice_number, trip_segments(trip_id)')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return { ok: false, message: t('pay.notFound') };
  if (inv.source !== 'manual') return { ok: false, message: t('pay.errKsefDelete') };

  const { error } = await supabase.from('purchase_invoices').delete().eq('id', invoiceId);
  if (error) return { ok: false, message: t('dir.updateError', { msg: error.message }) };
  if (inv.file_path) await supabase.storage.from('documents').remove([inv.file_path as string]);
  const tripId = (Array.isArray(inv.trip_segments) ? inv.trip_segments[0] : (inv.trip_segments as any))?.trip_id as string | undefined;
  if (inv.segment_id) await recalcSegmentCost(supabase, inv.segment_id as string);
  if (tripId) {
    await logAudit({
      entity_type: 'trip',
      entity_id: tripId,
      action: 'update',
      changes: { purchase_invoice: { before: inv.invoice_number, after: null } },
      summary: `Удалён счёт подрядчика ${inv.invoice_number ?? ''} (внесён вручную)`,
    });
    revalidatePath(`/trips/${tripId}`);
  }
  revalidatePath('/payables');
  return { ok: true };
}

/** Возможное задвоение: это не дубль — убрать из списка. */
export async function dismissTripDouble(manualId: string): Promise<Result> {
  await requireCapability('payables.edit');
  const supabase = await createClient();
  const { data } = await supabase.from('integration_state').select('value').eq('key', NOT_DOUBLE_KEY).maybeSingle();
  let ids: string[] = [];
  try {
    ids = data?.value ? JSON.parse(data.value) : [];
  } catch {
    ids = [];
  }
  if (!ids.includes(manualId)) ids = [...ids, manualId].slice(-2000);
  const { error } = await supabase.from('integration_state').upsert({ key: NOT_DOUBLE_KEY, value: JSON.stringify(ids), updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: error.message };
  revalidatePath('/payables');
  return { ok: true };
}

/** Возможное задвоение: ручная запись — тот же расход, что и счёт; удалить её. */
export async function deleteManualTripExpense(manualId: string): Promise<Result> {
  await requireCapability('payables.edit');
  const { t } = await getT();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('trip_expenses')
    .select('id, trip_id, category, description, original_amount, currency, purchase_invoice_id')
    .eq('id', manualId)
    .maybeSingle();
  if (!row || row.purchase_invoice_id) return { ok: false, message: t('payx2.errTrip') };
  const { data: tr } = await supabase.from('trips').select('id, trip_number, start_date, end_date').eq('id', row.trip_id).maybeSingle();
  if (tr && (await isMonthClosed(supabase, tripMonth(tr)))) return { ok: false, message: t('payx2.errClosed') };
  const { error } = await supabase.from('trip_expenses').delete().eq('id', manualId).is('purchase_invoice_id', null);
  if (error) return { ok: false, message: error.message };
  await logAudit({
    entity_type: 'trip',
    entity_id: row.trip_id,
    action: 'update',
    changes: { manual_expense: { before: `${row.category ?? ''} ${row.description ?? ''} ${row.original_amount ?? ''} ${row.currency ?? ''}`.trim(), after: null } },
    summary: `Рейс №${tr?.trip_number ?? '—'}: удалена ручная запись расхода — дубль счёта`,
  });
  revalidatePath('/payables');
  revalidatePath(`/trips/${row.trip_id}`);
  return { ok: true };
}
