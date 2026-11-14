import 'server-only';

import ExcelJS from 'exceljs';
import { IMPORT_SPECS, MAX_IMPORT_ROWS, type CellValue, type ImportType } from './import-rules';
import type { MessageKey, T } from './i18n/translate';

/** Подпись колонки шаблона: «Имя *». */
export function columnLabel(field: string, required: boolean | undefined, t: T): string {
  return t(`imp.col_${field}` as MessageKey) + (required ? ' *' : '');
}

/** Шаблон .xlsx: лист «Данные» с заголовками и лист с подсказками. */
export async function buildTemplate(type: ImportType, t: T): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t('imp.sheetData'), { views: [{ state: 'frozen', ySplit: 1 }] });
  const spec = IMPORT_SPECS[type];
  ws.columns = spec.map((c) => ({
    header: columnLabel(c.field, c.required, t),
    width: c.kind === 'date' ? 16 : Math.max(16, columnLabel(c.field, c.required, t).length + 4),
    style: c.kind === 'date' ? { numFmt: 'dd.mm.yyyy' } : {},
  }));
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };

  const help = wb.addWorksheet(t('imp.sheetHelp'));
  help.getColumn(1).width = 110;
  [t('imp.help1'), t('imp.help2'), t('imp.help3')].forEach((line) => help.addRow([line]));
  return wb.xlsx.writeBuffer();
}

function cell(v: ExcelJS.CellValue): CellValue {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'object') {
    if ('result' in v) return cell(v.result as ExcelJS.CellValue);          // формула
    if ('richText' in v) return v.richText.map((r) => r.text).join('');     // форматированный текст
    if ('text' in v) return String(v.text);                                  // ссылка
  }
  return String(v);
}

/** Первый лист без строки заголовков. null — файл не читается или превышает лимит. */
export async function readSheet(buffer: ArrayBuffer): Promise<{ rows: CellValue[][] } | { error: 'badFile' | 'tooBig' }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { error: 'badFile' };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { error: 'badFile' };
  if (ws.rowCount - 1 > MAX_IMPORT_ROWS) return { error: 'tooBig' };
  const rows: CellValue[][] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const values: CellValue[] = [];
    for (let c = 1; c <= ws.columnCount; c++) values.push(cell(row.getCell(c).value));
    rows.push(values);
  }
  return { rows };
}
