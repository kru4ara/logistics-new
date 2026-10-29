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
  BorderStyle,
} from 'docx';
import { fmtDate, txt, divider, cellLabel, cellValue, FONT, LINE, BLUE, RED, GREEN, GRAY, AMBER } from '../../../../../../../lib/docx/helpers';
import { createClient } from '../../../../../../../lib/supabase/admin';
import { COMPANY } from '../../../../../../../lib/company';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildPointParagraphs(params: {
  idx: number;
  kind: 'loading' | 'unloading' | 'reload';
  date: string | null;
  company: string | null;
  country: string | null;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  loading_number?: string | null;
  label?: string;
}): Paragraph[] {
  const { idx, kind, date, company, country, city, postal_code, address, loading_number, label } = params;

  const cityLine = [postal_code, city, country].filter(Boolean).join(', ') || '—';
  const numberColor = kind === 'unloading' ? RED : kind === 'reload' ? AMBER : GREEN;

  const children: Paragraph[] = [
    new Paragraph({
      spacing: { line: LINE, after: 20, before: 0 },
      children: [
        new TextRun({ text: `#${idx}   `, bold: true, size: 22, font: FONT, color: numberColor }),
        new TextRun({ text: date ? fmtDate(date, '.') : '—', bold: true, size: 22, font: FONT, color: BLUE }),
        new TextRun({ text: '   ', size: 22, font: FONT }),
        new TextRun({ text: company || '—', bold: true, size: 22, font: FONT, color: '0F172A' }),
        ...(label
          ? [
              new TextRun({ text: '   ', size: 18, font: FONT }),
              new TextRun({ text: label, size: 16, font: FONT, color: numberColor, italics: true }),
            ]
          : []),
      ],
    }),
  ];

  if (cityLine !== '—') {
    children.push(
      new Paragraph({
        spacing: { line: LINE, after: 20, before: 0 },
        children: [new TextRun({ text: '      ' + cityLine, size: 20, font: FONT, color: '475569' })],
      })
    );
  }

  if (address) {
    children.push(
      new Paragraph({
        spacing: { line: LINE, after: 20, before: 0 },
        children: [new TextRun({ text: '      ' + address, size: 20, font: FONT, color: '475569' })],
      })
    );
  }

  if (loading_number) {
    children.push(
      new Paragraph({
        spacing: { line: LINE, after: 20, before: 0 },
        children: [
          new TextRun({ text: '      № погрузки: ', size: 18, font: FONT, color: GRAY }),
          new TextRun({ text: loading_number, bold: true, size: 18, font: FONT, color: BLUE }),
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

  // 1. Проверяем авторизацию и права
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('driver_id, role')
    .eq('id', user.id)
    .single();

  const role = String(profile?.role || 'driver').trim().toLowerCase();
  const isAdmin = role === 'admin' || role === 'manager';

  // 2. Получаем рейс
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('id, trip_number, client_request_number, trailer_id')
    .eq('id', tripId)
    .single();

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Рейс не найден' }, { status: 404 });
  }

  // 3. Получаем сегмент
  const { data: segment, error: segErr } = await supabase
    .from('trip_segments')
    .select('*')
    .eq('id', segmentId)
    .single();

  if (segErr || !segment) {
    return NextResponse.json({ error: 'Участок не найден' }, { status: 404 });
  }

  // 4. ПРОВЕРКА ВЛАДЕЛЬЦА (защита от IDOR)
  // Водитель может скачать только свой сегмент.
  // Админ/менеджер — любой.
  if (!isAdmin && segment.driver_id !== profile?.driver_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (segment.executor_type !== 'us') {
    return NextResponse.json(
      { error: 'Задание водителю формируется только для нашего участка' },
      { status: 400 }
    );
  }

  let driver: {
    first_name: string | null;
    last_name: string | null;
    phone_by: string | null;
    phone_pl: string | null;
  } | null = null;
  if (segment.driver_id) {
    const { data } = await supabase
      .from('drivers')
      .select('first_name, last_name, phone_by, phone_pl')
      .eq('id', segment.driver_id)
      .maybeSingle();
    driver = data;
  }

  let truck: { registration_number: string | null } | null = null;
  if (segment.truck_id) {
    const { data } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', segment.truck_id)
      .maybeSingle();
    truck = data;
  }

  let trailer: { registration_number: string | null } | null = null;
  if (trip.trailer_id) {
    const { data } = await supabase
      .from('trucks')
      .select('registration_number')
      .eq('id', trip.trailer_id)
      .maybeSingle();
    trailer = data;
  }

  const { data: segmentCargoRaw } = await supabase
    .from('trip_segment_cargo')
    .select('cargo_id, trip_cargo(position, label, cargo_type, weight_kg)')
    .eq('segment_id', segmentId);

  const cargoItems: { position: number; label: string; cargoType: string | null; weight: number | null }[] = [];
  (segmentCargoRaw || []).forEach((sc: any) => {
    const c = Array.isArray(sc.trip_cargo) ? sc.trip_cargo[0] : sc.trip_cargo;
    if (!c) return;
    cargoItems.push({
      position: c.position || 0,
      label: c.label || '—',
      cargoType: c.cargo_type || null,
      weight: c.weight_kg ?? null,
    });
  });
  cargoItems.sort((a, b) => a.position - b.position);

  const baseNumber = trip.client_request_number ?? trip.trip_number ?? '?';
  const taskNumber = `${baseNumber}-${segment.position || 1}`;

  const driverName = driver
    ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || '—'
    : '—';

  const children: any[] = [];

  children.push(txt(COMPANY.name, { bold: true, size: 28, after: 20, color: BLUE }));
  children.push(txt(COMPANY.address, { size: 18, after: 0, color: GRAY }));
  children.push(
    txt(`NIP ${COMPANY.nip}  ·  REGON ${COMPANY.regon}  ·  EORI ${COMPANY.eori}`, {
      size: 16,
      after: 0,
      color: GRAY,
    })
  );
  children.push(divider());

  children.push(txt(`Дата формирования: ${fmtDate(new Date().toISOString(), '.')}`, { size: 18, after: 0, color: GRAY }));

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: LINE, before: 120, after: 40 },
      children: [
        new TextRun({ text: 'ЗАДАНИЕ ВОДИТЕЛЮ № ', bold: true, size: 28, font: FONT, color: '334155' }),
        new TextRun({ text: taskNumber, bold: true, size: 40, font: FONT, color: RED }),
      ],
    })
  );

  children.push(divider());

  const infoRows: TableRow[] = [
    new TableRow({
      children: [cellLabel('Водитель'), cellValue(driverName, { bold: true, size: 24 })],
    }),
  ];
  // Телефоны: BY и PL (оба, если есть)
  const phoneParts: string[] = [];
  if (driver?.phone_by) phoneParts.push(`BY: ${driver.phone_by}`);
  if (driver?.phone_pl) phoneParts.push(`PL: ${driver.phone_pl}`);
  if (phoneParts.length > 0) {
    infoRows.push(
      new TableRow({ children: [cellLabel('Телефон'), cellValue(phoneParts.join(' · '))] })
    );
  }
  infoRows.push(
    new TableRow({
      children: [cellLabel('Тягач'), cellValue(truck?.registration_number || '—', { bold: true })],
    })
  );
  if (trailer?.registration_number) {
    infoRows.push(
      new TableRow({
        children: [cellLabel('Прицеп'), cellValue(trailer.registration_number, { bold: true })],
      })
    );
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: infoRows,
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

  children.push(txt('МАРШРУТ', { bold: true, size: 24, after: 100, color: BLUE }));

  const routeRows: TableRow[] = [];
  let idxCounter = 0;

  idxCounter++;
  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: buildPointParagraphs({
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

    const kind = stop.type === 'unload' ? 'unloading' : stop.type === 'reload' ? 'reload' : 'loading';
    const labelMap: Record<string, string | undefined> = {
      load: 'загрузка',
      reload: 'догруз / перегруз',
      unload: 'выгрузка',
    };

    routeRows.push(
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 60, bottom: 60, left: 0, right: 0 },
            children: buildPointParagraphs({
              idx: idxCounter,
              kind,
              date: stop.date || null,
              company: stop.company || null,
              country: stop.country || null,
              city: stop.city || null,
              postal_code: stop.postal_code || null,
              address: stop.address || null,
              label: labelMap[stop.type] || undefined,
            }),
          }),
        ],
      })
    );
  }

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

  idxCounter++;
  routeRows.push(
    new TableRow({
      children: [
        new TableCell({
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: buildPointParagraphs({
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

  if (cargoItems.length > 0) {
    children.push(txt('ГРУЗЫ', { bold: true, size: 24, after: 100, color: BLUE }));

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
                children: [new TextRun({ text: '№', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Описание', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Тип', bold: true, size: 20, font: FONT, color: '334155' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            shading: { fill: 'F1F5F9' },
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Вес', bold: true, size: 20, font: FONT, color: '334155' })],
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
                  children: [
                    new TextRun({ text: `#${c.position}`, bold: true, size: 20, font: FONT, color: '334155' }),
                  ],
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
                  children: [
                    new TextRun({
                      text: c.weight != null ? `${c.weight} kg` : '—',
                      size: 20,
                      font: FONT,
                      color: '475569',
                    }),
                  ],
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

  if (segment.notes) {
    children.push(txt('ЗАМЕТКИ', { bold: true, size: 22, after: 100, color: BLUE }));
    children.push(txt(segment.notes, { size: 20, after: 200, color: '334155' }));
  }

  children.push(divider());
  children.push(txt('', { after: 200 }));
  children.push(
    txt('Подпись водителя об ознакомлении:', {
      bold: true,
      size: 22,
      after: 60,
      color: '334155',
    })
  );
  children.push(txt('_______________________________________', { size: 22, after: 40, color: '94A3B8' }));
  children.push(txt('(дата / подпись)', { size: 16, after: 0, color: GRAY, italics: true }));

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

  const safeDriver = (driverName || 'driver').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Zadanie_${taskNumber}_${safeDriver}.docx`;

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
