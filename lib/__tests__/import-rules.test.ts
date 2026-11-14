import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { parseImport, parseDate, dedupeKey, IMPORT_SPECS } from '../import-rules';

describe('импорт: даты', () => {
  it('понимает разные форматы', () => {
    expect(parseDate('2026-05-10')).toBe('2026-05-10');
    expect(parseDate('10.05.2026')).toBe('2026-05-10');
    expect(parseDate('1/2/2027')).toBe('2027-02-01');
    expect(parseDate(new Date(Date.UTC(2026, 4, 10)))).toBe('2026-05-10');
    expect(parseDate(46152)).toBe('2026-05-10'); // серийный номер Excel
    expect(parseDate('')).toBeNull();
    expect(parseDate('31.02.2026')).toBe('bad');
    expect(parseDate('завтра')).toBe('bad');
  });
});

describe('импорт: строки', () => {
  it('водители: обязательные поля, даты, дубли в файле и в базе', () => {
    const empty = Array(IMPORT_SPECS.drivers.length).fill(null);
    const row = (over: Record<number, unknown>) => empty.map((v, i) => (i in over ? over[i] : v));
    const res = parseImport(
      'drivers',
      [
        row({ 0: 'Jan', 1: 'Kowalski', 7: '01.06.2027' }),
        row({ 0: 'Anna' }),                               // нет фамилии
        row({ 0: 'Piotr', 1: 'Nowak', 7: 'когда-нибудь' }), // плохая дата
        row({ 0: ' jan ', 1: 'KOWALSKI' }),               // дубль в файле
        row({ 0: 'Ivan', 1: 'Petrov' }),                  // уже есть в базе
        row({}),                                          // пустая строка — пропуск без ошибки
      ] as never,
      new Set([dedupeKey('drivers', { first_name: 'Ivan', last_name: 'Petrov' })])
    );
    expect(res.total).toBe(5);
    expect(res.valid.map((v) => v.record.last_name)).toEqual(['Kowalski']);
    expect(res.valid[0].record.passport_expiry).toBe('2027-06-01');
    expect(res.errors).toEqual([
      { row: 3, field: 'last_name', code: 'required' },
      { row: 4, field: 'passport_expiry', code: 'date' },
      { row: 5, field: null, code: 'duplicateFile' },
      { row: 6, field: null, code: 'exists' },
    ]);
  });

  it('машины: тип на любом языке, год числом, номер без пробелов для дублей', () => {
    const res = parseImport('trucks', [
      ['WGM 1234A', 'ciągnik', 'DAF', 'XF', '2019'],
      ['WGM1235B', 'Прицеп', null, null, '20.5'],
      ['WGM-1234A', 'trailer'],
      ['AB123', 'bus'],
    ], new Set());
    expect(res.valid.map((v) => [v.record.registration_number, v.record.type, v.record.year])).toEqual([
      ['WGM 1234A', 'tractor', 2019],
    ]);
    expect(res.errors.map((e) => [e.row, e.code])).toEqual([[3, 'int'], [4, 'duplicateFile'], [5, 'type']]);
  });
});

describe('импорт: шаблон → файл → разбор', () => {
  it('заполненный шаблон читается и разбирается', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const { buildTemplate, readSheet } = await import('../import-excel');
    const { createT } = await import('../i18n/translate');
    const { MESSAGES } = await import('../i18n/messages');
    const t = createT(MESSAGES.pl);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await buildTemplate('trucks', t));
    const ws = wb.worksheets[0];
    expect(ws.getRow(1).getCell(1).value).toBe('Nr rejestracyjny *');
    ws.addRow(['WGM 1234A', 'ciągnik', 'DAF', 'XF', 2019, null, new Date(Date.UTC(2027, 0, 31))]);
    ws.addRow([{ richText: [{ text: 'WGM ' }, { text: '9' }] }, 'naczepa']);

    const sheet = await readSheet(await wb.xlsx.writeBuffer() as ArrayBuffer);
    if ('error' in sheet) throw new Error(sheet.error);
    const res = parseImport('trucks', sheet.rows, new Set());
    expect(res.errors).toEqual([]);
    expect(res.valid.map((v) => [v.record.registration_number, v.record.type, v.record.truck_insurance_expiry])).toEqual([
      ['WGM 1234A', 'tractor', '2027-01-31'],
      ['WGM 9', 'trailer', null],
    ]);
  });
});
