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
import imageSize from 'image-size';
import { createClient } from '../../../../../../../lib/supabase-server';
import { COMPANY, APP_URL, getTerms } from '../../../../../../../lib/company';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

function getImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  try {
    const dims = imageSize(buffer);
    if (dims.width && dims.height) return { width: dims.width, height: dims.height };
    return null;
  } catch {
    return null;
  }
}

function scaleImage(
  dims: { width: number; height: number } | null,
  maxWidth: number,
  maxHeight: number,
  fallback: { width: number; height: number }
): { width: number; height: number } {
  if (!dims || dims.width === 0 || dims.height === 0) return fallback;
  const ratio = dims.width / dims.height;
  let w = maxWidth;
  let h = Math.round(maxWidth / ratio);
  if (h > maxHeight) {
    h = maxHeight;
    w = Math.round(maxHeight * ratio);
  }
  return { width: w, height: h };
}

async function downloadAsset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  label: string
): Promise<Buffer | null> {
  try {
    const { data, error } = await supabase.storage.from('documents').download(path);
    if (error || !data) {
      console.error(`[DOCX-SC] ${label} download error:`, error);
      return null;
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.error(`[DOCX-SC] ${label} exception:`, e);
    return null;
  }
}

async function generateQrBuffer(text: string): Promise<Buffer | null> {
  try {
    return await QRCode.toBuffer(text, {
      type: 'png',
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1E40AF', light: '#FFFFFF' },
    });
  } catch (e) {
    console.error('[DOCX-SC] QR generation error:', e);
    return null;
  }
}

const FONT = 'Calibri';
const LINE = 240;
const BLUE = '1E40AF';
const RED = 'B91C1C';
const GREEN = '15803D';
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
    spacing: { line: LINE, before: opts?.before ?? 0, after: opts?.after ?? 40 },
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
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 } },
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
        children: [new TextRun({ text, bold: true, size: 22, font: FONT, color: '334155' })],
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

function buildPointChildren(params: {
  idx: number;
  kind: 'loading' | 'unloading';
  date: string | null;
  company: string | null;
  country: string | null;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  loading_number: string | null;
}): Paragraph[] {
  const { idx, kind, date, company, country, city, postal_code, address, loading_number } = params;

  const cityLine = [postal_code, city, country].filter(Boolean).join(', ') || '—';
  const numberColor = kind === 'loading' ? GREEN : RED;

  const children: Paragraph[] = [
    new Paragraph({
      spacing: { line: LINE, after: 20, before: 0 },
      children: [
        new TextRun({ text: `#${idx}   `, bold: true, size: 20, font: FONT, color: numberColor }),
        new TextRun({
          text: date ? fmtDate(date) : '—',
          bold: true,
          size: 20,
          font: FONT,
          color: BLUE,
        }),
        new TextRun({ text: '   ', size: 20, font: FONT }),
        new TextRun({
          text: company || '—',
          bold: true,
          size: 20,
          font: FONT,
          color: '0F172A',
        }),
      ],
    }),
  ];

  if (cityLine !== '—') {
    children.push(
      new Paragraph({
        spacing: { line: LINE, after: 20, before: 0 },
        children: [
          new TextRun({ text: '      ' + cityLine, size: 18, font: FONT, color: '475569' }),
        ],
      })
    );
  }

  if (address) {
    children.push(
      new Paragraph({
        spacing: { line: LINE, after: 20, before: 0 },
        children: [
          new TextRun({ text: '      ' + address, size: 18, font: FONT, color: '475569' }),
        ],
      })
    );
  }

  if (loading_number) {
    children.push(
      new Paragraph({
        spacing: { line: LINE, after: 20, before: 0 },
        children: [
          new TextRun({ text: '      Nr załadunku: ', size: 18, font: FONT, color: '475569' }),
          new TextRun({ text: loading_number, bold: true, size: 18, font: FONT, color: '334155' }),
        ],
      })
    );
  }

  return children;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; scid: string }> }
) {
  const { id: tripId, scid: subcontractorId } = await params;

  const supabase = await createClient();

  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, trip_number, client_request_number')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  }

  const { data: sub, error: subErr } = await supabase
    .from('trip_subcontractors')
    .select('*, contractors(*)')
    .eq('id', subcontractorId)
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ error: 'Подрядчик не найден' }, { status: 404 });
  }

  const contractor = Array.isArray(sub.contractors) ? sub.contractors[0] : sub.contractors;
  if (!contractor) {
    return NextResponse.json({ error: 'Карточка подрядчика не найдена' }, { status: 404 });
  }

  // КЛИЕНТСКИЙ номер заявки — приоритет. Fallback на trip_number.
  const baseNumber = trip.client_request_number ?? trip.trip_number ?? '?';
  const zlecenieNumber = `${baseNumber}-${sub.position || 1}`;

  const paymentDays = sub.payment_days || 30;
  const terms = getTerms(paymentDays);

  const [stampBuf, qrBuf] = await Promise.all([
    downloadAsset(supabase, 'assets/stamp.png', 'STAMP'),
    generateQrBuffer(`${APP_URL}/trips/${tripId}`),
  ]);

  const stampDims = stampBuf ? getImageDimensions(stampBuf) : null;
  const qrDims = qrBuf ? getImageDimensions(qrBuf) : null;

  const stampSize = scaleImage(stampDims, 180, 200, { width: 160, height: 200 });
  const qrSize = scaleImage(qrDims, 110, 110, { width: 110, height: 110 });

  const children: any[] = [];

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
            transformation: { width: qrSize.width, height: qrSize.height },
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

  children.push(
    txt(contractor.full_name || contractor.name || '—', {
      bold: true,
      size: 28,
      after: 60,
      color: BLUE,
    })
  );

  if (contractor.country) {
    children.push(txt(`Kraj: ${contractor.country}`, { size: 22, after: 20, color: '334155' }));
  }
  if (contractor.address) children.push(txt(contractor.address, { size: 22, after: 20 }));
  if (contractor.tax_id) {
    children.push(txt(`NIP: ${contractor.tax_id}`, { size: 22, after: 20, color: '334155' }));
  }
  if (contractor.contact_person) {
    children.push(txt(contractor.contact_person, { size: 22, after: 20 }));
  }
  if (contractor.phone) {
    children.push(txt(`tel. ${contractor.phone}`, { size: 22, after: 20, color: '334155' }));
  }
  if (contractor.email) {
    children.push(txt(contractor.email, { size: 20, after: 20, color: '475569' }));
  }

  children.push(divider());

  const truckDriverChildren: Paragraph[] = [];
  if (sub.truck_number) {
    truckDriverChildren.push(
      new Paragraph({
        spacing: { line: LINE, after: 40, before: 0 },
        children: [
          new TextRun({ text: 'Numer auta:  ', bold: true, size: 22, font: FONT, color: '334155' }),
          new TextRun({ text: sub.truck_number, bold: true, size: 28, font: FONT, color: RED }),
        ],
      })
    );
  }
  if (sub.driver_name) {
    truckDriverChildren.push(
      new Paragraph({
        spacing: { line: LINE, after: 40, before: 0 },
        children: [
          new TextRun({ text: 'Kierowca:  ', bold: true, size: 22, font: FONT, color: '334155' }),
          new TextRun({ text: sub.driver_name, bold: true, size: 28, font: FONT, color: RED }),
        ],
      })
    );
  }
  if (sub.driver_phone) {
    truckDriverChildren.push(
      new Paragraph({
        spacing: { line: LINE, after: 40, before: 0 },
        children: [
          new TextRun({ text: 'tel.  ', bold: true, size: 22, font: FONT, color: '334155' }),
          new TextRun({ text: sub.driver_phone, size: 22, font: FONT, color: '334155' }),
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

  // TRASA (A → C)
  const routeRows: TableRow[] = [];

  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: buildPointChildren({
            idx: 1,
            kind: 'loading',
            date: sub.load_date,
            company: sub.load_company,
            country: sub.load_country,
            city: sub.load_city,
            postal_code: sub.load_postal_code,
            address: sub.load_address,
            loading_number: sub.load_number,
          }),
        }),
      ],
    })
  );

  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: [
            new Paragraph({
              spacing: { line: LINE, after: 0, before: 0 },
              children: [
                new TextRun({ text: '▼', size: 18, font: FONT, color: '94A3B8' }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: buildPointChildren({
            idx: 1,
            kind: 'unloading',
            date: sub.unload_date,
            company: sub.unload_company,
            country: sub.unload_country,
            city: sub.unload_city,
            postal_code: sub.unload_postal_code,
            address: sub.unload_address,
            loading_number: sub.unload_number,
          }),
        }),
      ],
    })
  );

  children.push(
    txt('TRASA / MARSZRUT', { bold: true, size: 22, after: 100, color: BLUE })
  );

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
        left: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
        right: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: routeRows,
    })
  );

  children.push(txt('', { after: 200 }));

  // ТАБЛИЦА ДЕТАЛЕЙ (как в экспедировании)
  const transportText = [
    sub.transport_type,
    sub.transport_temperature ? `(${sub.transport_temperature})` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const cargoText =
    [sub.cargo_type, sub.cargo_quantity].filter(Boolean).join(' ') || '—';

  const detailRows: TableRow[] = [
    new TableRow({
      children: [cellLabel('Rodzaj transportu'), cellValue(transportText || '—', { bold: true })],
    }),
    new TableRow({
      children: [cellLabel('Urząd celny (załadunek)'), cellValue(sub.customs_loading || 'bez')],
    }),
    new TableRow({
      children: [cellLabel('Rodzaj towaru'), cellValue(cargoText, { bold: true })],
    }),
    new TableRow({
      children: [
        cellLabel('Odprawa celna (rozładunek)'),
        cellValue(
          sub.customs_unloading
            ? `${sub.customs_unloading} przy rozładunku`
            : 'bez przy rozładunku'
        ),
      ],
    }),
    new TableRow({
      children: [
        cellLabel('FRACHT'),
        cellValue(`${sub.original_price || 0} ${sub.currency || 'EUR'} (vat = 0%)`, {
          bold: true,
          size: 28,
          color: RED,
        }),
      ],
    }),
  ];

  if (sub.notes) {
    detailRows.push(
      new TableRow({
        children: [cellLabel('Uwagi'), cellValue(sub.notes)],
      })
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: detailRows,
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

  // СТРАНИЦА 2
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(
    txt('WARUNKI ZLECENIA', { bold: true, size: 28, after: 240, color: BLUE })
  );

  terms.forEach((t) => {
    children.push(
      new Paragraph({
        spacing: { line: 276, before: 0, after: 120 },
        children: [new TextRun({ text: t, size: 22, font: FONT, color: '1F2937' })],
      })
    );
  });

  children.push(txt('', { after: 500 }));

  const signatureChildren: Paragraph[] = [
    new Paragraph({
      spacing: { line: LINE, after: 80, before: 0 },
      children: [
        new TextRun({
          text: 'Podpis przewoźnika / akceptacja zlecenia:',
          bold: true,
          size: 22,
          font: FONT,
          color: '334155',
        }),
      ],
    }),
    new Paragraph({
      spacing: { line: LINE, after: 40, before: 0 },
      children: [
        new TextRun({
          text: '_______________________________________',
          size: 22,
          font: FONT,
          color: '94A3B8',
        }),
      ],
    }),
    new Paragraph({
      spacing: { line: LINE, after: 0, before: 60 },
      children: [
        new TextRun({
          text: '(data / podpis / pieczątka)',
          size: 16,
          font: FONT,
          color: GRAY,
          italics: true,
        }),
      ],
    }),
  ];

  const stampChildren: Paragraph[] = [];
  if (stampBuf) {
    stampChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE, after: 60, before: 0 },
        children: [
          new ImageRun({
            data: stampBuf,
            transformation: { width: stampSize.width, height: stampSize.height },
            type: 'png',
          }),
        ],
      })
    );
    stampChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE, after: 0, before: 0 },
        children: [
          new TextRun({ text: COMPANY.name, bold: true, size: 18, font: FONT, color: BLUE }),
        ],
      })
    );
  } else {
    stampChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: LINE, after: 0, before: 0 },
        children: [
          new TextRun({
            text: '(pieczęć nie załadowana)',
            size: 14,
            font: FONT,
            color: 'DC2626',
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
              width: { size: 55, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 0, right: 200 },
              children: signatureChildren,
            }),
            new TableCell({
              width: { size: 45, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 0, bottom: 0, left: 200, right: 0 },
              children: stampChildren,
            }),
          ],
        }),
      ],
    })
  );

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
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
