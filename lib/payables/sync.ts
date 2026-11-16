import 'server-only';
import { createClient } from '../supabase/admin';
import { fetchAll, fetchAllByIds } from '../fetch-all';
import { logAudit } from '../audit';
import { isKsefConfigured, queryPurchaseMetadata, downloadInvoiceXml, type InvoiceMetadata } from '../ksef/client';
import { parseFa3, MAX_WINDOW_DAYS, dateWindows } from '../ksef/rules';
import { findDuplicateGroups, planManualMerge } from './duplicate-rules';
import { suggestSegments, autoMatch, normalizeNip, type SegmentCandidate, type PurchaseForMatch } from './match-rules';
import { recalcSegmentCost } from './cost';

const STATE_KEY = 'ksef.purchases.hwm';
/** первый запуск — за 60 дней назад */
const FIRST_RUN_DAYS = 60;
/** не больше фактур за запуск: лимит KSeF на загрузку — 64 в час */
const MAX_DOWNLOADS = 40;

export type PurchaseSyncReport =
  | { ok: true; found: number; downloaded: number; matched: number; remaining: number }
  | { ok: false; reason: 'notConfigured' | 'error'; message?: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Участки подрядчиков за последние ~8 месяцев — кандидаты для сопоставления. */
export async function loadSegmentCandidates(supabase: Supabase, extraIds: string[] = []): Promise<SegmentCandidate[]> {
  const since = new Date(Date.now() - 240 * 86_400_000).toISOString().slice(0, 10);
  const SELECT = 'id, trip_id, position, contractor_id, price, currency, date_from, date_to, contractors(name, tax_id), trips!inner(trip_number, client_request_number)';
  const { data } = await fetchAll(
    supabase
      .from('trip_segments')
      .select(SELECT)
      .eq('executor_type', 'contractor')
      .or(`date_to.gte.${since},date_to.is.null`),
  );
  const rows = (data ?? []) as any[];
  // Участки старше окна, к которым уже привязаны счета, — тоже нужны для показа.
  const missing = extraIds.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length) {
    const { data: more } = await fetchAllByIds(missing, (chunk) => supabase.from('trip_segments').select(SELECT).in('id', chunk));
    rows.push(...((more ?? []) as any[]));
  }
  const { data: linkedRows } = await fetchAllByIds(
    rows.map((r) => r.id),
    (chunk) => supabase.from('purchase_invoices').select('segment_id').in('segment_id', chunk),
  );
  const linked = new Set(((linkedRows ?? []) as { segment_id: string }[]).map((r) => r.segment_id));
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  return rows.map((r) => {
    const c = one<{ name: string; tax_id: string | null }>(r.contractors);
    const t = one<{ trip_number: string | null; client_request_number: string | null }>(r.trips);
    return {
      id: r.id,
      tripId: r.trip_id,
      tripNumber: t?.trip_number ?? null,
      clientRequestNumber: t?.client_request_number ?? null,
      position: r.position ?? 1,
      contractorId: r.contractor_id,
      contractorName: c?.name ?? null,
      contractorNip: c?.tax_id ?? null,
      price: r.price != null ? Number(r.price) : null,
      currency: r.currency,
      dateFrom: r.date_from,
      dateTo: r.date_to,
      linked: linked.has(r.id),
    };
  });
}

type StoredInvoice = PurchaseForMatch & { id: string; ksef_number: string; contractor_id: string | null };

async function matchUnlinked(supabase: Supabase): Promise<number> {
  const { data } = await fetchAll(
    supabase
      .from('purchase_invoices')
      .select('id, ksef_number, seller_nip, invoice_number, issue_date, net_amount, gross_amount, currency, description, contractor_id')
      .is('segment_id', null)
      .eq('match_status', 'none'),
  );
  const invoices: StoredInvoice[] = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    ksef_number: r.ksef_number,
    contractor_id: r.contractor_id,
    sellerNip: r.seller_nip,
    invoiceNumber: r.invoice_number,
    issueDate: r.issue_date,
    net: r.net_amount != null ? Number(r.net_amount) : null,
    gross: r.gross_amount != null ? Number(r.gross_amount) : null,
    currency: r.currency,
    description: r.description,
  }));
  if (!invoices.length) return 0;

  const segments = await loadSegmentCandidates(supabase);
  const { data: contractors } = await fetchAll(supabase.from('contractors').select('id, tax_id'));
  const contractorByNip = new Map<string, string>();
  for (const c of (contractors ?? []) as { id: string; tax_id: string | null }[]) {
    const n = normalizeNip(c.tax_id);
    if (n && !contractorByNip.has(n)) contractorByNip.set(n, c.id);
  }

  let matched = 0;
  for (const inv of invoices) {
    const suggestions = suggestSegments(inv, segments);
    const segId = autoMatch(suggestions, segments);
    const contractorId = inv.contractor_id ?? contractorByNip.get(normalizeNip(inv.sellerNip) ?? '') ?? null;
    const patch: Record<string, unknown> = {};
    if (contractorId && contractorId !== inv.contractor_id) patch.contractor_id = contractorId;
    if (segId) {
      patch.segment_id = segId;
      patch.match_status = 'auto';
      const seg = segments.find((s) => s.id === segId)!;
      seg.linked = true; // одна фактура на участок в этом проходе
      if (!patch.contractor_id && seg.contractorId) patch.contractor_id = seg.contractorId;
    }
    if (!Object.keys(patch).length) continue;
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase.from('purchase_invoices').update(patch).eq('id', inv.id);
    if (!error && segId) {
      matched++;
      await recalcSegmentCost(supabase, segId);
      const seg = segments.find((s) => s.id === segId)!;
      await logAudit({
        entity_type: 'trip',
        entity_id: seg.tripId,
        action: 'update',
        changes: { purchase_invoice: { before: null, after: inv.invoiceNumber } },
        summary: `Счёт подрядчика ${inv.invoiceNumber ?? inv.ksef_number} привязан к участку ${seg.position} автоматически (KSeF)`,
      });
    }
  }
  return matched;
}

/**
 * Ручной счёт, который позже пришёл из KSeF: перенести привязку, оплату и файл в строку
 * KSeF и удалить ручную — иначе расход рейса учтён дважды. Неоднозначные пары
 * (привязаны к разным участкам) остаются — их показывает «Возможные дубли».
 */
async function mergeManualDuplicates(supabase: Supabase): Promise<void> {
  const { data } = await fetchAll(
    supabase.from('purchase_invoices').select('id, source, seller_nip, invoice_number, segment_id, match_status, paid_at, file_path, contractor_id'),
  );
  const rows = (data ?? []) as any[];
  for (const g of findDuplicateGroups(rows)) {
    const plan = planManualMerge(g);
    if (!plan) continue;
    const { keep, drop } = plan as { keep: any; drop: any };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!keep.segment_id && drop.segment_id) {
      patch.segment_id = drop.segment_id;
      patch.match_status = 'manual';
    }
    if (!keep.paid_at && drop.paid_at) patch.paid_at = drop.paid_at;
    if (!keep.file_path && drop.file_path) patch.file_path = drop.file_path;
    if (!keep.contractor_id && drop.contractor_id) patch.contractor_id = drop.contractor_id;
    const { error } = await supabase.from('purchase_invoices').update(patch).eq('id', keep.id);
    if (error) continue;
    // Файл переехал в строку KSeF — удаляем только запись.
    const { error: delErr } = await supabase.from('purchase_invoices').delete().eq('id', drop.id);
    if (delErr) continue;
    const segId = (patch.segment_id as string | undefined) ?? keep.segment_id;
    if (segId) await recalcSegmentCost(supabase, segId);
    await logAudit({
      entity_type: 'purchase_invoice',
      entity_id: keep.id,
      action: 'merge',
      changes: { manual_duplicate: { before: drop.id, after: keep.id } },
      summary: `Счёт ${keep.invoice_number ?? ''}: ручная запись объединена с фактурой из KSeF`,
    });
  }
}

/**
 * Пересчитать стоимость подрядчика у участков со счетами за ~полгода: выравнивает
 * расходы, если счёт привязали/отвязали до появления пересчёта или правили участок.
 */
async function recalcLinkedSegments(supabase: Supabase): Promise<void> {
  const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await fetchAll(
    supabase.from('purchase_invoices').select('segment_id').not('segment_id', 'is', null).gte('issue_date', since),
  );
  const ids = [...new Set(((data ?? []) as { segment_id: string }[]).map((r) => r.segment_id))];
  for (const id of ids) await recalcSegmentCost(supabase, id);
}

/**
 * Скачать новые входящие фактуры из KSeF и сопоставить с участками подрядчиков.
 * since (YYYY-MM-DD) — догрузить прошлый период: окна по ≤ 90 дней от since до отметки
 * последней загрузки; отметку не трогает (обычная загрузка продолжает с неё).
 */
export async function runKsefPurchaseSync(opts: { since?: string } = {}): Promise<PurchaseSyncReport> {
  if (!isKsefConfigured()) return { ok: false, reason: 'notConfigured' };
  const supabase = await createClient();

  const { data: state } = await supabase.from('integration_state').select('value').eq('key', STATE_KEY).maybeSingle();
  const saved = Date.parse(state?.value ?? '');
  const backfill = Boolean(opts.since);

  let meta: InvoiceMetadata[] = [];
  let hwm: string | null = null;
  try {
    if (backfill) {
      const fromIso = new Date(`${opts.since}T00:00:00Z`).toISOString();
      const toIso = new Date(Number.isNaN(saved) ? Date.now() : saved).toISOString();
      // KSeF: не больше 20 запросов метаданных в час — ограничиваем окна (≈ 2 года).
      for (const w of dateWindows(fromIso, toIso).slice(0, 8)) {
        meta.push(...(await queryPurchaseMetadata(w.from, w.to)).invoices);
      }
    } else {
      const floor = Date.now() - MAX_WINDOW_DAYS * 86_400_000;
      const from = new Date(Number.isNaN(saved) ? Date.now() - FIRST_RUN_DAYS * 86_400_000 : Math.max(saved, floor)).toISOString();
      ({ invoices: meta, hwm } = await queryPurchaseMetadata(from));
    }
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }

  const { data: known } = await fetchAllByIds(
    meta.map((m) => m.ksefNumber),
    (chunk) => supabase.from('purchase_invoices').select('ksef_number').in('ksef_number', chunk),
  );
  const have = new Set(((known ?? []) as { ksef_number: string }[]).map((r) => r.ksef_number));
  const fresh = meta.filter((m) => !have.has(m.ksefNumber));
  const batch = fresh.slice(0, MAX_DOWNLOADS);

  let downloaded = 0;
  let lastStored: string | null = null;
  let failed: string | null = null;
  for (const m of batch) {
    try {
      const xml = await downloadInvoiceXml(m.ksefNumber);
      const p = parseFa3(xml);
      const { error } = await supabase.from('purchase_invoices').insert({
        ksef_number: m.ksefNumber,
        invoice_number: p.invoiceNumber ?? m.invoiceNumber,
        invoice_type: p.invoiceType ?? m.invoiceType,
        issue_date: p.issueDate ?? m.issueDate?.slice(0, 10),
        seller_nip: p.sellerNip ?? m.seller?.nip ?? null,
        seller_name: p.sellerName ?? m.seller?.name ?? null,
        net_amount: p.net ?? m.netAmount,
        vat_amount: p.vat ?? m.vatAmount,
        gross_amount: p.gross ?? m.grossAmount,
        currency: p.currency ?? m.currency,
        payment_due: p.paymentDue,
        bank_account: p.bankAccount,
        description: p.description,
        stored_at: m.permanentStorageDate,
        xml,
      });
      if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
      downloaded++;
      lastStored = m.permanentStorageDate;
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
      break; // не перескакиваем фактуру: продолжим с неё в следующий раз
    }
  }

  // Отметка «просмотрено до»: всё скачали — HWM KSeF; иначе — последняя скачанная.
  const remaining = fresh.length - downloaded;
  const mark = remaining === 0 && !failed ? hwm ?? lastStored : lastStored;
  if (mark && !backfill) {
    await supabase.from('integration_state').upsert({ key: STATE_KEY, value: mark, updated_at: new Date().toISOString() });
  }

  await mergeManualDuplicates(supabase);
  const matched = await matchUnlinked(supabase);
  await recalcLinkedSegments(supabase);
  if (failed && downloaded === 0) return { ok: false, reason: 'error', message: failed };
  return { ok: true, found: fresh.length, downloaded, matched, remaining };
}
