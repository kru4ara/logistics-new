import 'server-only';
import { getDocumentProxy } from 'unpdf';

/**
 * Текст PDF построчно: куски одной строки (одинаковая высота ±2 pt) слева направо;
 * большой промежуток между кусками — «   » (три пробела), как ждёт lib/bank/pko-rules.
 */
export async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows: { y: number; items: { x: number; w: number; s: string }[] }[] = [];
    for (const it of content.items as { str?: string; transform?: number[]; width?: number }[]) {
      if (!it.str || !it.str.trim() || !it.transform) continue;
      const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2);
      if (!row) rows.push((row = { y, items: [] }));
      row.items.push({ x: it.transform[4], w: it.width ?? 0, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      let line = '';
      let end: number | null = null;
      for (const it of r.items) {
        if (end != null) {
          const gap = it.x - end;
          line += gap > 8 ? '   ' : gap > 1.5 ? ' ' : '';
        }
        line += it.s;
        end = it.x + it.w;
      }
      out.push(line);
    }
  }
  return out;
}
