import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  TableCell,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

// Общие константы оформления документов
export const FONT = 'Calibri';
export const LINE = 240;
export const BLUE = '1E40AF';
export const RED = 'B91C1C';
export const GREEN = '15803D';
export const GRAY = '6B7280';
export const AMBER = 'D97706';

export type TextOpts = {
  bold?: boolean;
  italics?: boolean;
  size?: number;
  before?: number;
  after?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  color?: string;
};

export type CellValueOpts = {
  bold?: boolean;
  size?: number;
  color?: string;
  width?: number;
};

/**
 * Форматирует дату. Разделитель задаётся параметром:
 * '/' — офисные документы, '.' — документ для водителя.
 */
export function fmtDate(d: string | null, sep: '/' | '.' = '/'): string {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}${sep}${String(dt.getMonth() + 1).padStart(2, '0')}${sep}${dt.getFullYear()}`;
}

export function txt(text: string, opts?: TextOpts): Paragraph {
  return new Paragraph({
    alignment: opts?.align,
    spacing: { line: LINE, before: opts?.before ?? 0, after: opts?.after ?? 40 },
    children: [
      new TextRun({
        text,
        bold: opts?.bold,
        italics: opts?.italics,
        size: opts?.size ?? 22,
        font: FONT,
        color: opts?.color,
      }),
    ],
  });
}

export function divider(): Paragraph {
  return new Paragraph({
    spacing: { line: LINE, before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 } },
    children: [new TextRun({ text: '', size: 4 })],
  });
}

export function cellLabel(text: string, width = 38): TableCell {
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

export function cellValue(text: string, opts?: CellValueOpts): TableCell {
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
