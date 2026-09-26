import { NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ImageRun,
  BorderStyle,
  VerticalAlign,
} from 'docx';
import { createClient } from '../../../../../../../lib/supabase-server';
import { COMPANY, STAMP_URL, getTerms } from '../../../../../../../lib/company';

// ============================================================
// Утилиты
// ============================================================
function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// ============================================================
// Хелперы — компактные параграфы
// ============================================================
const FONT = 'Calibri';
const LINE = 240; // одинарный межстрочный (в twips)

type TextOpts = {
  bold?: boolean;
  size?: number; // half-points (20 = 10pt)
  before?: number;
  after?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  color?: string;
};

function txt(text: string, opts?: TextOpts): Paragraph {
  return new Paragraph({
    alignment: opts?.align,
    spacing: {
      line: LINE,
      before: opts?.before ?? 0,
      after: opts?.after ?? 40,
    },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 20,
        font: FONT,
        color: opts?.color,
      }),
    ],
  });
}

function txtRight(text: string, opts?: TextOpts): Paragraph {
  return txt(text, { ...opts, align: AlignmentType.RIGHT });
}

function cell(
  text: string,
  opts?: { bold?: boolean; width?: number; size?: number }
): TableCell {
  return new TableCell({
    width: opts?.width
      ? { size: opts.width, type: WidthType.PERCENTAGE }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: 30,
      bottom: 30,
      left: 60,
      right: 60,
    },
    children: [
      new Paragraph({
        spacing: { line: LINE, after: 0, before: 0 },
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            size: opts?.size ?? 18,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

// ============================================================
// GET — генерирует DOCX
// ============================================================
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  const { id: forwardingId, cid: fcId } = await params;

  const supabase = await createClient();

  const { data: order, error: orderErr } = await supabase
    .from('forwarding_orders')
    .select('*, clients(name)')
    .eq('id', forwardingId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  const { data: fc, error: fcErr } = await supabase
    .from('forwarding_contractors')
    .select('*, contractors(*)')
    .eq('id', fcId)
    .single();

  if (fcErr || !fc) {
    return NextResponse.json({ error: 'Подрядчик не найден' }, { status: 404 });
  }

  const contractor = fc.contractors;
  const paymentDays = fc.payment_days || 30;
  const terms = getTerms(paymentDays);

  const zlecenieNumber = order.client_request_number
    ? `${order.client_request_number}-${fc.position || 1}`
    : `${order.order_number || '?'}-${fc.position || 1}`;

  const stampBuf = await fetchImage(STAMP_URL);

  // ============================================================
  // Формируем содержимое
  // ============================================================
  const children: any[] = [];

  // --- РЕКВИЗИТЫ ---
  children.push(txt(COMPANY.name, { bold: true, size: 22, after: 20 }));
  children.push(txt(COMPANY.address, { size: 18, after: 0 }));
  children.push(txt(`NIP ${COMPANY.nip} - REGON ${COMPANY.regon}`, { size: 18, after: 0 }));
  children.push(txt(COMPANY.bank, { size: 18, after: 0 }));
  children.push(txt(`EORI ${COMPANY.eori}`, { size: 18, after: 0 }));
  children.push(txt(`${COMPANY.accountEur} (EUR)`, { size: 18, after: 0 }));
  children.push(txt(`${COMPANY.accountPln} (PLN)`, { size: 18, after: 0 }));

  // --- ДАТА И НОМЕР ---
  children.push(txtRight(`${COMPANY.city}, ${fmtDate(new Date().toISOString())}`, { size: 20, before: 240 }));

  children.push(
    new Paragraph({
      spacing: { line: LINE, before: 80, after: 160 },
      children: [
        new TextRun({ text: 'ZLECENIE TRANSPORTOWE Nr: ', bold: true, size: 22, font: FONT }),
        new TextRun({ text: zlecenieNumber, bold: true, size: 22, font: FONT }),
      ],
    })
  );

  // --- ВСТУПЛЕНИЕ ---
  children.push(
    txt(
      'RAIBUILDING SP. Z O.O. działając w imieniu swoich Klientów oraz w oparciu o przepisy Konwencji CMR zleca wykonanie przewozu firmie:',
      { size: 20, after: 120 }
    )
  );

  // --- ПОДРЯДЧИК ---
  if (contractor) {
    children.push(txt(contractor.full_name || contractor.name || '—', { bold: true, size: 22, after: 40 }));
    if (contractor.address) children.push(txt(contractor.address, { size: 20, after: 20 }));
    if (contractor.tax_id) children.push(txt(contractor.tax_id, { size: 20, after: 20 }));
    if (contractor.contact_person) children.push(txt(contractor.contact_person, { size: 20, after: 20 }));
    if (contractor.phone) children.push(txt(`tel. ${contractor.phone}`, { size: 20, after: 20 }));
    if (contractor.email) children.push(txt(contractor.email, { size: 20, after: 20 }));
  }

  // --- МАШИНА / ВОДИТЕЛЬ ---
  const truckDriver = [];
  if (fc.truck_number) truckDriver.push(`Numer auta: ${fc.truck_number}`);
  if (fc.driver_name) truckDriver.push(`Kierowca: ${fc.driver_name}`);
  if (truckDriver.length > 0) {
    children.push(
      txt(truckDriver.join('  |  '), { bold: true, size: 20, before: 120, after: 200 })
    );
  }

  // --- УСЛОВИЯ (компактно) ---
  terms.forEach((t) => {
    children.push(
      new Paragraph({
        spacing: { line: LINE, before: 0, after: 60 },
        children: [
          new TextRun({
            text: t,
            size: 18,
            font: FONT,
          }),
        ],
      })
    );
  });

  // --- ТАБЛИЦА ---
  const loadingPlace =
    [order.route_from, order.loading_reference ? `Reference: ${order.loading_reference}` : null]
      .filter(Boolean)
      .join(', ') || '—';

  const unloadingPlace = order.route_to || '—';

  const cargoText =
    [order.cargo_type, order.cargo_quantity].filter(Boolean).join(' ') ||
    order.cargo_description ||
    '—';

  const rows: TableRow[] = [
    new TableRow({ children: [cell('0', { bold: true, width: 6 }), cell('Rodzaj transportu', { width: 32 }), cell(order.transport_type || '—', { width: 62 })] }),
    new TableRow({ children: [cell('1', { bold: true, width: 6 }), cell('Miejsce załadunku', { width: 32 }), cell(loadingPlace, { width: 62 })] }),
    new TableRow({ children: [cell('2', { bold: true, width: 6 }), cell('Data załadunku', { width: 32 }), cell(fmtDate(order.load_date), { width: 62 })] }),
    new TableRow({ children: [cell('3', { bold: true, width: 6 }), cell('Urząd celny', { width: 32 }), cell(order.customs_loading || 'bez', { width: 62 })] }),
    new TableRow({ children: [cell('4', { bold: true, width: 6 }), cell('Rodzaj towaru', { width: 32 }), cell(cargoText, { width: 62 })] }),
    new TableRow({ children: [cell('5', { bold: true, width: 6 }), cell('Data rozładunku', { width: 32 }), cell(fmtDate(order.unload_date), { width: 62 })] }),
    new TableRow({ children: [cell('6', { bold: true, width: 6 }), cell('Odprawa celna', { width: 32 }), cell(order.customs_unloading ? `${order.customs_unloading} przy rozładunku` : 'bez przy rozładunku', { width: 62 })] }),
    new TableRow({ children: [cell('7', { bold: true, width: 6 }), cell('Miejsce rozładunku', { width: 32 }), cell(unloadingPlace, { width: 62 })] }),
    new TableRow({ children: [cell('8', { bold: true, width: 6 }), cell('Fracht', { width: 32 }), cell(`${fc.original_price || 0} ${fc.currency || 'EUR'} ( vat = 0%)`, { bold: true, width: 62 })] }),
  ];

  children.push(
    new Paragraph({
      spacing: { line: LINE, before: 200, after: 0 },
      children: [new TextRun({ text: '', size: 2 })],
    })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '000000' },
      },
    })
  );

  // --- ПЕЧАТЬ ---
  if (stampBuf) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE, before: 200, after: 0 },
        children: [
          new ImageRun({
            data: stampBuf,
            transformation: { width: 180, height: 180 },
            type: 'png',
          }),
        ],
      })
    );
  }

  // ============================================================
  // Собираем
  // ============================================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: 500,
              right: 500,
              bottom: 500,
              left: 500,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  const safeContractor = (contractor?.name || 'contractor').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Zlecenie_${zlecenieNumber}_${safeContractor}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
