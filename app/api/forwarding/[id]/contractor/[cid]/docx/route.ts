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
// Хелперы для параграфов
// ============================================================
function p(text: string, opts?: { bold?: boolean; size?: number; spacing?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: opts?.spacing ?? 80 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 20,
        font: 'Calibri',
      }),
    ],
  });
}

function pRight(text: string, opts?: { bold?: boolean; size?: number }): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 20,
        font: 'Calibri',
      }),
    ],
  });
}

function pCenter(text: string, opts?: { bold?: boolean; size?: number }): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 20,
        font: 'Calibri',
      }),
    ],
  });
}

function cell(text: string, opts?: { bold?: boolean; width?: number }): TableCell {
  return new TableCell({
    width: opts?.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    children: [
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            size: 20,
            font: 'Calibri',
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

  // Загружаем заявку
  const { data: order, error: orderErr } = await supabase
    .from('forwarding_orders')
    .select('*, clients(name)')
    .eq('id', forwardingId)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Заявка не найдена' }, { status: 404 });
  }

  // Загружаем подрядчика заявки
  const { data: fc, error: fcErr } = await supabase
    .from('forwarding_contractors')
    .select('*, contractors(*)')
    .eq('id', fcId)
    .single();

  if (fcErr || !fc) {
    return NextResponse.json({ error: 'Подрядчик не найден' }, { status: 404 });
  }

  const contractor = fc.contractors;
  const clientName = Array.isArray(order.clients) ? order.clients[0]?.name : order.clients?.name;

  const paymentDays = fc.payment_days || 30;
  const terms = getTerms(paymentDays);

  // Номер заявки подрядчику: {client_request_number}-{position}
  const zlecenieNumber = order.client_request_number
    ? `${order.client_request_number}-${fc.position || 1}`
    : `${order.order_number || '?'}-${fc.position || 1}`;

  // Загружаем печать
  const stampBuf = await fetchImage(STAMP_URL);

  // ============================================================
  // Формируем документ
  // ============================================================
  const children: any[] = [];

  // --- РЕКВИЗИТЫ ---
  children.push(p(COMPANY.name, { bold: true, size: 24 }));
  children.push(p(COMPANY.address, { size: 18 }));
  children.push(p(`NIP ${COMPANY.nip} - REGON ${COMPANY.regon}`, { size: 18 }));
  children.push(p(COMPANY.bank, { size: 18 }));
  children.push(p(`EORI ${COMPANY.eori}`, { size: 18 }));
  children.push(p(`${COMPANY.accountEur} (EUR)`, { size: 18 }));
  children.push(p(`${COMPANY.accountPln} (PLN)`, { size: 18 }));

  children.push(p('', { spacing: 200 }));

  // --- ДАТА И НОМЕР ---
  children.push(pRight(`${COMPANY.city}, ${fmtDate(new Date().toISOString())}`, { size: 20 }));
  children.push(p('', { spacing: 60 }));
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: 'ZLECENIE TRANSPORTOWE Nr: ', bold: true, size: 24, font: 'Calibri' }),
        new TextRun({ text: zlecenieNumber, bold: true, size: 24, font: 'Calibri' }),
      ],
    })
  );

  // --- ВСТУПИТЕЛЬНЫЙ ТЕКСТ ---
  children.push(
    p(
      'RAIBUILDING SP. Z O.O. działając w imieniu swoich Klientów oraz w oparciu o przepisy Konwencji CMR zleca wykonanie przewozu firmie:',
      { size: 20 }
    )
  );
  children.push(p('', { spacing: 120 }));

  // --- ПОДРЯДЧИК ---
  if (contractor) {
    children.push(p(contractor.full_name || contractor.name || '—', { bold: true, size: 22 }));
    if (contractor.address) children.push(p(contractor.address, { size: 20 }));
    if (contractor.tax_id) children.push(p(contractor.tax_id, { size: 20 }));
    if (contractor.contact_person) children.push(p(contractor.contact_person, { size: 20 }));
    if (contractor.phone) children.push(p(`tel. ${contractor.phone}`, { size: 20 }));
    if (contractor.email) children.push(p(contractor.email, { size: 20 }));
  }
  children.push(p('', { spacing: 120 }));

  // --- МАШИНА / ВОДИТЕЛЬ ---
  const truckDriver = [];
  if (fc.truck_number) truckDriver.push(`Numer auta: ${fc.truck_number}`);
  if (fc.driver_name) truckDriver.push(`Kierowca: ${fc.driver_name}`);
  if (truckDriver.length > 0) {
    children.push(p(truckDriver.join(' '), { bold: true, size: 20 }));
    children.push(p('', { spacing: 120 }));
  }

  // --- УСЛОВИЯ ---
  terms.forEach((t) => {
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: t,
            size: 18,
            font: 'Calibri',
          }),
        ],
      })
    );
  });

  children.push(p('', { spacing: 200 }));

  // --- ТАБЛИЦА ---
  // Место загрузки: route_from + reference
  const loadingPlace = [order.route_from, order.loading_reference ? `Reference loading: ${order.loading_reference}` : null]
    .filter(Boolean)
    .join(', ');

  // Место разгрузки: route_to
  const unloadingPlace = order.route_to || '—';

  // Груз: cargo_type + cargo_quantity
  const cargoText = [order.cargo_type, order.cargo_quantity].filter(Boolean).join(' ') || order.cargo_description || '—';

  const rows: TableRow[] = [
    new TableRow({
      children: [cell('0', { bold: true, width: 8 }), cell('Rodzaj transportu', { width: 32 }), cell(order.transport_type || '—', { width: 60 })],
    }),
    new TableRow({
      children: [cell('1', { bold: true, width: 8 }), cell('Miejsce załadunku', { width: 32 }), cell(loadingPlace || '—', { width: 60 })],
    }),
    new TableRow({
      children: [cell('2', { bold: true, width: 8 }), cell('Data załadunku', { width: 32 }), cell(fmtDate(order.load_date), { width: 60 })],
    }),
    new TableRow({
      children: [cell('3', { bold: true, width: 8 }), cell('Urząd celny', { width: 32 }), cell(order.customs_loading || 'bez', { width: 60 })],
    }),
    new TableRow({
      children: [cell('4', { bold: true, width: 8 }), cell('Rodzaj towaru', { width: 32 }), cell(cargoText, { width: 60 })],
    }),
    new TableRow({
      children: [cell('5', { bold: true, width: 8 }), cell('Data rozładunku', { width: 32 }), cell(fmtDate(order.unload_date), { width: 60 })],
    }),
    new TableRow({
      children: [cell('6', { bold: true, width: 8 }), cell('Odprawa celna', { width: 32 }), cell(order.customs_unloading ? `${order.customs_unloading} przy rozładunku` : 'bez przy rozładunku', { width: 60 })],
    }),
    new TableRow({
      children: [cell('7', { bold: true, width: 8 }), cell('Miejsce rozładunku', { width: 32 }), cell(unloadingPlace, { width: 60 })],
    }),
    new TableRow({
      children: [
        cell('8', { bold: true, width: 8 }),
        cell('Fracht', { width: 32 }),
        cell(`${fc.original_price || 0} ${fc.currency || 'EUR'} ( vat = 0%)`, { bold: true, width: 60 }),
      ],
    }),
  ];

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

  children.push(p('', { spacing: 300 }));

  // --- ПЕЧАТЬ + ПОДПИСЬ ---
  if (stampBuf) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 100 },
        children: [
          new ImageRun({
            data: stampBuf,
            transformation: { width: 220, height: 220 },
            type: 'png',
          }),
        ],
      })
    );
  }

  // ============================================================
  // Собираем документ
  // ============================================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  const fileName = `Zlecenie_${zlecenieNumber}_${(contractor?.name || 'contractor').replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
