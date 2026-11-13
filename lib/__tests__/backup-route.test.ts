import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { decryptBackup, parseBackupKey } from '../backup-crypto';

// --- заглушки --------------------------------------------------------------

vi.mock('server-only', () => ({}));

const alerts: string[] = [];
vi.mock('../cron-alert', () => ({
  sendCronAlert: vi.fn(async (_job: string, msg: string) => {
    alerts.push(msg);
  }),
  sendCronSummary: vi.fn(async () => {}),
}));

// Таблица → строки. trip_expenses больше 1000 — проверка постраничного чтения.
const DB: Record<string, Record<string, unknown>[]> = {
  drivers: [{ id: 'd1', last_name: 'KAVALIOU' }],
  profiles: [{ id: 'u1', role: 'office' }],
  driver_transactions: [{ id: 'tx1', amount: 100 }],
  trip_expenses: Array.from({ length: 1500 }, (_, i) => ({ id: `e${String(i).padStart(4, '0')}` })),
  rates: [{ rate_date: '2026-11-13', eur_pln: 4.25 }],
};
const orderedBy: Record<string, string[]> = {};

function tableBuilder(table: string) {
  const rows = DB[table] ?? [];
  const b = {
    select: () => b,
    order: (col: string) => {
      (orderedBy[table] ||= []).push(col);
      return b;
    },
    limit: () => Promise.resolve({ data: [], error: null }), // audit_log
    insert: () => Promise.resolve({ error: null }),
    range: (from: number, to: number) =>
      Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }),
  };
  return b;
}

vi.mock('../supabase/admin', () => ({
  createClient: async () => ({ from: (t: string) => tableBuilder(t) }),
}));

// --- тесты -----------------------------------------------------------------

const KEY = randomBytes(32).toString('base64');
let sent: { filename: string; bytes: Buffer; caption: string } | null;

beforeEach(() => {
  alerts.length = 0;
  sent = null;
  for (const k of Object.keys(orderedBy)) delete orderedBy[k];
  vi.stubEnv('CRON_SECRET', 's3cret');
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot');
  vi.stubEnv('TELEGRAM_CHAT_ID', '1');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: FormData }) => {
      const doc = init.body.get('document') as File;
      sent = {
        filename: doc.name,
        bytes: Buffer.from(await doc.arrayBuffer()),
        caption: String(init.body.get('caption')),
      };
      return new Response('{"ok":true}', { status: 200 });
    })
  );
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function callBackup() {
  const { GET } = await import('../../app/api/cron/backup/route');
  return GET(new Request('https://x/api/cron/backup', { headers: { authorization: 'Bearer s3cret' } }));
}

describe('cron backup', () => {
  it('без ключа шифрования ничего не отправляет и шлёт алерт', async () => {
    vi.stubEnv('BACKUP_ENCRYPTION_KEY', '');
    const res = await callBackup();
    expect(res.status).toBe(500);
    expect(sent).toBeNull();
    expect(alerts.join(' ')).toMatch(/BACKUP_ENCRYPTION_KEY/);
  });

  it('отправляет зашифрованный файл со всеми строками и ключевыми таблицами', async () => {
    vi.stubEnv('BACKUP_ENCRYPTION_KEY', KEY);
    const res = await callBackup();
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(sent!.filename).toMatch(/^backup_\d{4}-\d{2}-\d{2}_\d{4}\.json\.gz\.enc$/);
    expect(sent!.bytes.toString('latin1')).not.toContain('KAVALIOU');

    const backup = JSON.parse(decryptBackup(sent!.bytes, parseBackupKey(KEY)));
    // > 1000 строк прочитаны полностью
    expect(backup.tables.trip_expenses.count).toBe(1500);
    // таблицы, которых раньше не было в бэкапе
    for (const t of ['profiles', 'managers', 'driver_transactions', 'trip_counter', 'users']) {
      expect(backup.tables).toHaveProperty(t);
    }
    expect(backup.tables.driver_telegram_links).toBeUndefined();
    // стабильная сортировка: id, у rates — rate_date
    expect(orderedBy.trip_expenses).toEqual(['id']);
    expect(orderedBy.rates).toEqual(['rate_date']);
    expect(sent!.caption).toMatch(/зашифрован/);
  });

  it('без CRON_SECRET в заголовке — 401', async () => {
    vi.stubEnv('BACKUP_ENCRYPTION_KEY', KEY);
    const { GET } = await import('../../app/api/cron/backup/route');
    const res = await GET(new Request('https://x/api/cron/backup'));
    expect(res.status).toBe(401);
    expect(sent).toBeNull();
  });
});
