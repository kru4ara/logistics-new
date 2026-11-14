/**
 * Импорт справочников из Excel по шаблону: правила разбора строк.
 * Чистая логика без Supabase и ExcelJS — покрыта тестом (lib/__tests__/import-rules.test.ts).
 * Возвращает коды ошибок, текст подбирает страница (правило i18n № 3).
 *
 * Колонки шаблона идут в фиксированном порядке (IMPORT_SPECS): разбор по позиции,
 * а не по заголовку — заголовки в шаблоне на языке пользователя.
 */

export type ImportType = 'clients' | 'drivers' | 'trucks';
export const IMPORT_TYPES: readonly ImportType[] = ['clients', 'drivers', 'trucks'];

type Kind = 'text' | 'date' | 'int' | 'truckType';
export type ImportColumn = { field: string; kind: Kind; required?: boolean };

export const IMPORT_SPECS: Record<ImportType, ImportColumn[]> = {
  clients: [
    { field: 'name', kind: 'text', required: true },
    { field: 'contact_person', kind: 'text' },
    { field: 'phone', kind: 'text' },
    { field: 'email', kind: 'text' },
  ],
  drivers: [
    { field: 'first_name', kind: 'text', required: true },
    { field: 'last_name', kind: 'text', required: true },
    { field: 'phone_pl', kind: 'text' },
    { field: 'phone_by', kind: 'text' },
    { field: 'email', kind: 'text' },
    { field: 'date_of_birth', kind: 'date' },
    { field: 'passport_number', kind: 'text' },
    { field: 'passport_expiry', kind: 'date' },
    { field: 'visa_expiry', kind: 'date' },
    { field: 'license_number', kind: 'text' },
    { field: 'license_expiry', kind: 'date' },
    { field: 'tachograph_card_number', kind: 'text' },
    { field: 'tachograph_card_expiry', kind: 'date' },
    { field: 'code_95_expiry', kind: 'date' },
    { field: 'adr_expiry', kind: 'date' },
  ],
  trucks: [
    { field: 'registration_number', kind: 'text', required: true },
    { field: 'type', kind: 'truckType', required: true },
    { field: 'brand', kind: 'text' },
    { field: 'model', kind: 'text' },
    { field: 'year', kind: 'int' },
    { field: 'vin', kind: 'text' },
    { field: 'truck_insurance_expiry', kind: 'date' },
    { field: 'border_insurance_expiry', kind: 'date' },
    { field: 'to_expiry', kind: 'date' },
    { field: 'tech_inspection_expiry', kind: 'date' },
    { field: 'tachograph_calibration_expiry', kind: 'date' },
    { field: 'customs_certificate_expiry', kind: 'date' },
  ],
};

export const MAX_IMPORT_ROWS = 1000;

export type CellValue = string | number | boolean | Date | null | undefined;
export type ImportErrorCode = 'required' | 'date' | 'int' | 'type' | 'duplicateFile' | 'exists';
export type ImportError = { row: number; field: string | null; code: ImportErrorCode };
export type ImportRecord = Record<string, string | number | null>;
export type ParsedImport = {
  /** Строки, которые будут добавлены. */
  valid: { row: number; record: ImportRecord }[];
  /** Строки с ошибками и пропущенные дубли. Номер строки — как в Excel (заголовок — 1). */
  errors: ImportError[];
  /** Непустых строк в файле. */
  total: number;
};

const TRACTOR = new Set(['tractor', 'тягач', 'ciągnik', 'ciagnik', 'ciągnik siodłowy', 'truck']);
const TRAILER = new Set(['trailer', 'прицеп', 'полуприцеп', 'naczepa', 'przyczepa', 'причіп', 'напівпричіп', 'semi-trailer']);

function iso(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Дата из ячейки: Date, «2026-05-10», «10.05.2026», «10/05/2026», число Excel. */
export function parseDate(v: CellValue): string | null | 'bad' {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return 'bad';
    return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()) ?? 'bad';
  }
  if (typeof v === 'number') {
    // серийный номер Excel: 1 = 1900-01-01 (с ошибкой 1900 года — отсчёт от 1899-12-30)
    if (v < 1 || v > 2958465) return 'bad';
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) ?? 'bad';
  }
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]) ?? 'bad';
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]) ?? 'bad';
  return 'bad';
}

function text(v: CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return parseDate(v) as string;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s || null;
}

/** Ключ для поиска дублей: в файле и среди уже существующих записей. */
export function dedupeKey(type: ImportType, r: Record<string, unknown>): string {
  const n = (x: unknown) => String(x ?? '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  if (type === 'clients') return n(r.name);
  if (type === 'drivers') return `${n(r.first_name)}|${n(r.last_name)}`;
  return n(r.registration_number).replace(/[\s-]/g, '');
}

/**
 * Разобрать строки листа (без заголовка). existingKeys — ключи dedupeKey того,
 * что уже есть в базе: такие строки не добавляются (ошибка 'exists').
 */
export function parseImport(type: ImportType, rows: CellValue[][], existingKeys: Set<string>, firstRow = 2): ParsedImport {
  const spec = IMPORT_SPECS[type];
  const valid: ParsedImport['valid'] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  let total = 0;

  rows.forEach((cells, i) => {
    const row = firstRow + i;
    if (!cells || cells.every((c) => text(c) === null)) return;
    total++;
    const record: ImportRecord = {};
    let ok = true;

    spec.forEach((col, idx) => {
      const raw = cells[idx];
      let value: string | number | null = null;
      if (col.kind === 'date') {
        const d = parseDate(raw);
        if (d === 'bad') { errors.push({ row, field: col.field, code: 'date' }); ok = false; return; }
        value = d;
      } else if (col.kind === 'int') {
        const s = text(raw);
        if (s !== null) {
          const n = Number(s.replace(',', '.'));
          if (!Number.isInteger(n)) { errors.push({ row, field: col.field, code: 'int' }); ok = false; return; }
          value = n;
        }
      } else if (col.kind === 'truckType') {
        const s = text(raw)?.toLocaleLowerCase() ?? null;
        if (s !== null) {
          if (TRACTOR.has(s)) value = 'tractor';
          else if (TRAILER.has(s)) value = 'trailer';
          else { errors.push({ row, field: col.field, code: 'type' }); ok = false; return; }
        }
      } else {
        value = text(raw);
      }
      if (col.required && value === null) { errors.push({ row, field: col.field, code: 'required' }); ok = false; return; }
      record[col.field] = value;
    });

    if (!ok) return;
    const key = dedupeKey(type, record);
    if (existingKeys.has(key)) { errors.push({ row, field: null, code: 'exists' }); return; }
    if (seen.has(key)) { errors.push({ row, field: null, code: 'duplicateFile' }); return; }
    seen.add(key);
    valid.push({ row, record });
  });

  return { valid, errors, total };
}
