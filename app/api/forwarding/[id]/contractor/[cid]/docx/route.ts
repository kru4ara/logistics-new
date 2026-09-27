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
  PageBreak,
} from 'docx';
import QRCode from 'qrcode';
import { createClient } from '../../../../../../../lib/supabase-server';
import { COMPANY, STAMP_URL, APP_URL, getTerms } from '../../../../../../../lib/company';

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

async function generateQrBuffer(text: string): Promise<Buffer | null> {
  try {
    const buf = await QRCode.toBuffer(text, {
      type: 'png',
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1E40AF',
        light: '#FFFFFF',
      },
    });
    return buf;
  } catch {
    return null;
  }
}

// ============================================================
// Константы
// ============================================================
const FONT = 'Calibri';
const LINE = 240;
const BLUE = '1E40AF';
const RED = 'B91C1C';
const GRAY = '6B7280';

type TextOpts = {
  bold?: boolean;
  size?: number;
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
        size: opts?.size ?? 22,
        font: FONT,
        color: opts?.color,
      }),
    ],
  });
}

function divider(): Paragraph {
  return new Paragraph({
    spacing: { line: LINE, before: 80, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 },
    },
    children: [new TextRun({ text: '', size: 4 })],
  });
}

function cellLabel(text: string, width = 38): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 80 },
    shading: { fill: 'F1F5F9' },
    children: [
      new Paragraph({
        spacing: { line: LINE, after: 0, before: 0 },
        children: [
          new TextRun({
            text,
            bold: true,
            size: 22,
            font: FONT,
            color: '334155',
          }),
        ],
      }),
    ],
  });
}

function cellValue(
  text: string,
  opts?: { bold?: boolean; size?: number; color?: string; width?: number }
): TableCell {
  return new TableCell({
    width: { size: opts?.width ?? 62, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 80 },
    children: [
      new Paragraph({
        spacing: { line: LINE, after: 0, before: 0 },
        children: [
          new TextRun({
            text,
            bold: opts?.bold,
            size: opts?.size ?? 22,
            font: FONT,
            color: opts?.color,
          }),
        ],
      }),
    ],
  });
}

// ============================================================
// GET
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

  // Загружаем печать и QR-код параллельно
  const [stampBuf, qrBuf] = await Promise.all([
    fetchImage(STAMP_URL),
    generateQrBuffer(`${APP_URL}/forwarding/${forwardingId}`),
  ]);

  const children: any[] = [];

  // ============================================================
  // СТРАНИЦА 1
  // ============================================================

  // --- ШАПКА: слева реквизиты, справа QR-код ---
  const headerLeft: Paragraph[] = [
    txt(COMPANY.name, { bold: true, size: 28, after: 20, color: BLUE }),
    txt(COMPANY.address, { size: 20, after: 0 }),
    txt(`NIP ${COMPANY.nip}  ·  REGON ${COMPANY.regon}  ·  EORI ${COMPANY.eori}`, {
      size: 18,
      after: 0,
      color: GRAY,
    }),
    txt(COMPANY.bank, { size: 18, after: 0, color: GRAY }),
    txt(`EUR: ${COMPANY.accountEur}`, { size: 18, after: 0, color: GRAY }),
    txt(`PLN: ${COMPANY.accountPln}`, { size: 18, after: 0, color: GRAY }),
  ];

  const headerRight: Paragraph[] = [];
  if (qrBuf) {
    headerRight.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE, after: 40, before: 0 },
        children: [
          new ImageRun({
            data: qrBuf,
            transformation: { width: 110, height: 110 },
            type: 'png',
          }),
        ],
      })
    );
    headerRight.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE, after: 0, before: 0 },
        children: [
          new TextRun({
            text: 'Skanuj po szczegóły',
            size: 14,
            font: FONT,
            color: GRAY,
            italics: true,
          }),
        ],
      })
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 100 },
              children: headerLeft,
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: headerRight.length > 0 ? headerRight : [txt('')],
            }),
          ],
        }),
      ],
    })
  );

  children.push(divider());

  children.push(
    txt(`${COMPANY.city}, ${fmtDate(new Date().toISOString())}`, {
      size: 20,
      after: 0,
      color: GRAY,
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: LINE, before: 120, after: 40 },
      children: [
        new TextRun({
          text: 'ZLECENIE TRANSPORTOWE Nr: ',
          bold: true,
          size: 28,
          font: FONT,
          color: '334155',
        }),
        new TextRun({
          text: zlecenieNumber,
          bold: true,
          size: 40,
          font: FONT,
          color: RED,
        }),
      ],
    })
  );

  children.push(divider());

  children.push(
    txt(
      'RAIBUILDING SP. Z O.O. działając w imieniu swoich Klientów oraz w oparciu o przepisy Konwencji CMR zleca wykonanie przewozu firmie:',
      { size: 18, after: 120, color: '475569' }
    )
  );

  // --- ПОДРЯДЧИК ---
  if (contractor) {
    children.push(
      txt(contractor.full_name || contractor.name || '—', {
        bold: true,
        size: 28,
        after: 60,
        color: BLUE,
      })
    );
    if (contractor.address) children.push(txt(contractor.address, { size: 22, after: 20 }));
    if (contractor.tax_id)
      children.push(txt(`NIP: ${contractor.tax_id}`, { size: 22, after: 20, color: '334155' }));
    if (contractor.contact_person)
      children.push(txt(contractor.contact_person, { size: 22, after: 20 }));
    if (contractor.phone)
      children.push(txt(`tel. ${contractor.phone}`, { size: 22, after: 20, color: '334155' }));
    if (contractor.email)
      children.push(txt(contractor.email, { size: 20, after: 20, color: '475569' }));
  }

  children.push(divider());

  // --- МАШИНА / ВОДИТЕЛЬ ---
  const truckDriverChildren: Paragraph[] = [];
  if (fc.truck_number) {
    truckDriverChildren.push(
      new Paragraph({
        spacing: { line: LINE, after: 40, before: 0 },
        children: [
          new TextRun({ text: 'Numer auta:  ', bold: true, size: 22, font: FONT, color: '334155' }),
          new TextRun({ text: fc.truck_number, bold: true, size: 28, font: FONT, color: RED }),
        ],
      })
    );
  }
  if (fc.driver_name) {
    truckDriverChildren.push(
      new Paragraph({
        spacing: { line: LINE, after: 40, before: 0 },
        children: [
          new TextRun({ text: 'Kierowca:  ', bold: true, size: 22, font: FONT, color: '334155' }),
          new TextRun({ text: fc.driver_name, bold: true, size: 28, font: FONT, color: RED }),
        ],
      })
    );
  }

  if (truckDriverChildren.length > 0) {
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 12, color: BLUE },
          bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE },
          left: { style: BorderStyle.SINGLE, size: 12, color: BLUE },
          right: { style: BorderStyle.SINGLE, size: 12, color: BLUE },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 160, bottom: 160, left: 200, right: 200 },
                children: truckDriverChildren,
              }),
            ],
          }),
        ],
      })
    );
  }

  children.push(txt('', { after: 200 }));

  // --- ОСНОВНАЯ ТАБЛИЦА ---
  const loadingPlace =
    [order.route_from, order.loading_reference ? `Ref: ${order.loading_reference}` : null]
      .filter(Boolean)
      .join(' · ') || '—';

  const unloadingPlace = order.route_to || '—';

  const cargoText =
    [order.cargo_type, order.cargo_quantity].filter(Boolean).join(' ') ||
    order.cargo_description ||
    '—';

  const rows: TableRow[] = [
    new TableRow({
      children: [cellLabel('Rodzaj transportu'), cellValue(order.transport_type || '—', { bold: true })],
    }),
    new TableRow({
      children: [cellLabel('Miejsce załadunku'), cellValue(loadingPlace, { bold: true })],
    }),
    new TableRow({
      children: [cellLabel('Data załadunku'), cellValue(fmtDate(order.load_date), { bold: true, color: BLUE })],
    }),
    new TableRow({
      children: [cellLabel('Urząd celny'), cellValue(order.customs_loading || 'bez')],
    }),
    new TableRow({
      children: [cellLabel('Rodzaj towaru'), cellValue(cargoText, { bold: true })],
    }),
    new TableRow({
      children: [cellLabel('Data rozładunku'), cellValue(fmtDate(order.unload_date), { bold: true, color: BLUE })],
    }),
    new TableRow({
      children: [
        cellLabel('Odprawa celna'),
        cellValue(order.customs_unloading ? `${order.customs_unloading} przy rozładunku` : 'bez przy rozładunku'),
      ],
    }),
    new TableRow({
      children: [cellLabel('Miejsce rozładunku'), cellValue(unloadingPlace, { bold: true })],
    }),
    new TableRow({
      children: [
        cellLabel('FRACHT'),
        cellValue(`${fc.original_price || 0} ${fc.currency || 'EUR'} (vat = 0%)`, {
          bold: true,
          size: 28,
          color: RED,
        }),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 8, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      },
    })
  );

  // --- ПЕЧАТЬ (только справа, без таблицы, без QR) ---
  if (stampBuf) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE, before: 300, after: 0 },
        children: [
          new ImageRun({
            data: stampBuf,
            transformation: { width: 170, height: 170 },
            type: 'png',
          }),
        ],
      })
    );
  }

  // ============================================================
  // СТРАНИЦА 2 — УСЛОВИЯ
  // ============================================================
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(
    txt('WARUNKI ZLECENIA', {
      bold: true,
      size: 28,
      after: 240,
      color: BLUE,
    })
  );

  terms.forEach((t) => {
    children.push(
      new Paragraph({
        spacing: { line: 276, before: 0, after: 120 },
        children: [
          new TextRun({
            text: t,
            size: 22,
            font: FONT,
            color: '1F2937',
          }),
        ],
      })
    );
  });

  children.push(txt('', { after: 500 }));
  children.push(
    txt(
      'Podpis przewoźnika / akceptacja zlecenia:  ______________________________',
      { size: 20, color: GRAY }
    )
  );

  // ============================================================
  // Собираем
  // ============================================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 500, right: 600, bottom: 500, left: 600 },
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
