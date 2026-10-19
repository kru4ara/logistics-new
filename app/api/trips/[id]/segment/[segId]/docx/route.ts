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
      console.error(`[DOCX-SEG] ${label} download error:`, error);
      return null;
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.error(`[DOCX-SEG] ${label} exception:`, e);
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
    console.error('[DOCX-SEG] QR generation error:', e);
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
  kind: 'loading' | 'unloading' | 'reload' | 'customs';
  date: string | null;
  company: string | null;
  country: string | null;
  city: string | null;
  postal_code: string | null;
  address: string | null;
}): Paragraph[] {
  const { idx, kind, date, company, country, city, postal_code, address } = params;

  const cityLine = [postal_code, city, country].filter(Boolean).join(', ') || '—';
  
  // Определяем цвета и заголовки
  let numberColor = GREEN;
  let title = 'ZAŁADUNEK';
  
  if (kind === 'unloading') {
    numberColor = RED;
    title = 'ROZŁADUNEK';
  } else if (kind === 'reload') {
    numberColor = 'D97706';
    title = 'DOŁADUNEK / PRZEŁADUNEK';
  } else if (kind === 'customs') {
    numberColor = '2563EB'; // Синий
    title = 'ODPRAWA CELNA';
  }

  const children: Paragraph[] = [
    new Paragraph({
      spacing: { line: LINE, after: 20, before: 0 },
      children: [
        new TextRun({ text: `#${idx}   `, bold: true, size: 20, font: FONT, color: numberColor }),
        new TextRun({
          text: date ? fmtDate(date) : '',
          bold: true,
          size: 20,
          font: FONT,
          color: BLUE,
        }),
        ...(date ? [new TextRun({ text: '   ', size: 20, font: FONT })] : []),
        new TextRun({
          text: title,
          bold: true,
          size: 16,
          font: FONT,
          color: numberColor,
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

  return children;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; segId: string }> }
) {
  const { id: tripId, segId: segmentId } = await params;

  const supabase = await createClient();

  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, trip_number, client_request_number')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  }

  const { data: segment, error: segErr } = await supabase
    .from('trip_segments')
    .select('*')
    .eq('id', segmentId)
    .single();

  if (segErr || !segment) {
    return NextResponse.json({ error: 'Участок не найден' }, { status: 404 });
  }

  if (segment.executor_type !== 'contractor') {
    return NextResponse.json(
      { error: 'DOCX можно сформировать только для участка с подрядчиком' },
      { status: 400 }
    );
  }

  if (!segment.contractor_id) {
    return NextResponse.json({ error: 'У участка не указан подрядчик' }, { status: 400 });
  }

  const { data: contractor, error: cErr } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', segment.contractor_id)
    .single();

  if (cErr || !contractor) {
    return NextResponse.json({ error: 'Карточка подрядчика не найдена' }, { status: 404 });
  }

  // Грузы сегмента
  const { data: segmentCargoRaw } = await supabase
    .from('trip_segment_cargo')
    .select('cargo_id, trip_cargo(position, label, cargo_type, weight_kg, pallets)')
    .eq('segment_id', segmentId);

  const cargoItems: { position: number; label: string; cargoType: string | null; weight: number | null; pallets: number | null }[] = [];
  (segmentCargoRaw || []).forEach((sc: any) => {
    const c = Array.isArray(sc.trip_cargo) ? sc.trip_cargo[0] : sc.trip_cargo;
    if (!c) return;
    cargoItems.push({
      position: c.position || 0,
      label: c.label || '—',
      cargoType: c.cargo_type || null,
      weight: c.weight_kg ?? null,
      pallets: c.pallets ?? null,
    });
  });
  cargoItems.sort((a, b) => a.position - b.position);

  const baseNumber = trip.client_request_number ?? trip.trip_number ?? '?';
  const zlecenieNumber = `${baseNumber}-${segment.position || 1}`;

  const paymentDays = segment.contractor_payment_days ?? 30;
  const paymentDocType = (segment.contractor_payment_document_type === 'scans' ? 'scans' : 'originals') as 'originals' | 'scans';
  const terms = getTerms(paymentDays, paymentDocType);

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

  // ⬅️ НОВОЕ: Данные машины и водителя подрядчика
  if (segment.contractor_truck_number || segment.contractor_driver_name) {
    children.push(txt('', { after: 60 }));
    children.push(
      txt('Dane pojazdu i kierowcy:', { bold: true, size: 20, after: 40, color: '334155' })
    );
    if (segment.contractor_truck_number) {
      children.push(txt(`Nr auta: ${segment.contractor_truck_number}`, { size: 20, after: 20 }));
    }
    if (segment.contractor_driver_name) {
      children.push(txt(`Kierowca: ${segment.contractor_driver_name}`, { size: 20, after: 20 }));
    }
    if (segment.contractor_transport_type) {
      const typeMap: Record<string, string> = {
        standard: 'Standard / Plandeka',
        mega: 'Mega',
        chlodnia: 'Chłodnia',
      };
      const typeLabel = typeMap[segment.contractor_transport_type] || segment.contractor_transport_type;
      children.push(txt(`Rodzaj transportu: ${typeLabel}`, { size: 20, after: 20 }));
    }
    if (segment.contractor_transport_temperature) {
      children.push(txt(`Temperatura: ${segment.contractor_transport_temperature}`, { size: 20, after: 20 }));
    }
    if (segment.contractor_transport_height) {
      children.push(txt(`Wysokość załadunku: ${segment.contractor_transport_height}`, { size: 20, after: 20 }));
    }
  }

  children.push(divider());

  // ============================================================
  // TRASA / MARSZRUT — from → stops → to
  // ============================================================
  const routeRows: TableRow[] = [];

  let idxCounter = 0;

  // Точка A (from_*)
  idxCounter++;
  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: buildPointChildren({
            idx: idxCounter,
            kind: 'loading',
            date: segment.date_from,
            company: segment.from_company,
            country: segment.from_country,
            city: segment.from_city,
            postal_code: segment.from_postal_code,
            address: segment.from_address,
          }),
        }),
      ],
    })
  );

  // Промежуточные точки (stops)
  const stops = Array.isArray(segment.stops) ? segment.stops : [];
  for (const stop of stops) {
    idxCounter++;

    routeRows.push(
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 0, right: 0 },
            children: [
              new Paragraph({
                spacing: { line: LINE, after: 0, before: 0 },
                children: [new TextRun({ text: '▼', size: 18, font: FONT, color: '94A3B8' })],
              }),
            ],
          }),
        ],
      })
    );

    const kind = 
      stop.type === 'unload' ? 'unloading' : 
      stop.type === 'customs' ? 'customs' : 
      stop.type === 'reload' ? 'reload' : 'loading';

    routeRows.push(
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 0, right: 0 },
            children: buildPointChildren({
              idx: idxCounter,
              kind,
              date: stop.date || null,
              company: stop.company || null,
              country: stop.country || null,
              city: stop.city || null,
              postal_code: stop.postal_code || null,
              address: stop.address || null,
            }),
          }),
        ],
      })
    );

  // Стрелка перед точкой C
  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: [
            new Paragraph({
              spacing: { line: LINE, after: 0, before: 0 },
              children: [new TextRun({ text: '▼', size: 18, font: FONT, color: '94A3B8' })],
            }),
          ],
        }),
      ],
    })
  );

  // Точка C (to_*)
  idxCounter++;
  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: buildPointChildren({
            idx: idxCounter,
            kind: 'unloading',
            date: segment.date_to,
            company: segment.to_company,
            country: segment.to_country,
            city: segment.to_city,
            postal_code: segment.to_postal_code,
            address: segment.to_address,
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

  // ============================================================
  // TOWAR / ŁADUNEK
  // ============================================================
  if (cargoItems.length > 0) {
    children.push(
      txt('TOWAR / ŁADUNEK', { bold: true, size: 22, after: 100, color: BLUE })
    );

    const cargoRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Nr', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Opis towaru', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Rodzaj', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 17, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Palety', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 17, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Waga', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
        ],
      }),
    ];

    cargoItems.forEach((c) => {
      cargoRows.push(
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `#${c.position}`, bold: true, size: 20, font: FONT, color: '334155' })],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c.label, size: 20, font: FONT, color: '0F172A' })],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c.cargoType || '—', size: 20, font: FONT, color: '475569' })],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c.pallets != null ? `${c.pallets} szt.` : '—', size: 20, font: FONT, color: '475569' })],
                }),
              ],
            }),
            new TableCell({
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c.weight != null ? `${c.weight} kg` : '—', size: 20, font: FONT, color: '475569' })],
                }),
              ],
            }),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: cargoRows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
        },
      })
    );

    children.push(txt('', { after: 200 }));
  }

  // ============================================================
  // Детали / FRACHT
  // ============================================================
  const detailRows: TableRow[] = [
    new TableRow({
      children: [
        cellLabel('FRACHT'),
        cellValue(
          segment.price
            ? `${segment.price} ${segment.currency || 'EUR'} (vat = 0%)`
            : `— ${segment.currency || 'EUR'} (vat = 0%)`,
          { bold: true, size: 28, color: RED }
        ),
      ],
    }),
    new TableRow({
      children: [
        cellLabel('Płatność'),
        cellValue(`${paymentDays} dni`, { size: 22 }),
      ],
    }),
    new TableRow({
      children: [
        cellLabel('Dokumenty'),
        cellValue(
          segment.contractor_payment_document_type === 'scans' 
            ? 'Skany CMR' 
            : 'Oryginały CMR', 
          { size: 22 }
        ),
      ],
    }),
  ];

  if (segment.notes) {
    detailRows.push(
      new TableRow({
        children: [cellLabel('Uwagi'), cellValue(segment.notes)],
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
  });
}
