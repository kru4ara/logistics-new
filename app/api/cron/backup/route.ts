import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Таблицы для бэкапа: все ключевые данные.
// audit_log — ограничим 5000 последних, чтобы файл не раздувался.
const TABLES = [
  'clients',
  'contractors',
  'drivers',
  'trucks',
  'locations',
  'trips',
  'trip_expenses',
  'trip_subcontractors',
  'trip_documents',
  'forwarding_orders',
  'forwarding_contractors',
  'forwarding_points',
  'forwarding_expenses',
  'reminders',
  'rates',
  'documents',
  'fixed_costs',
];

async function sendTelegramDocument(
  filename: string,
  fileContent: string,
  caption: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[backup] Telegram env not set');
    return false;
  }

  try {
    const blob = new Blob([fileContent], { type: 'application/json' });
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('document', blob, filename);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
      {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error('[backup] Telegram send failed:', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[backup] Telegram exception:', e);
    return false;
  }
}

export async function GET(request: Request) {
  // Проверка CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const supabase = await createClient();

  const backup: {
    created_at: string;
    project: string;
    tables: Record<string, { count: number; rows: unknown[] }>;
    meta: Record<string, unknown>;
  } = {
    created_at: new Date().toISOString(),
    project: 'logistics-new / smodijsjwcvsscfgloh',
    tables: {},
    meta: {},
  };

  const errors: string[] = [];

  // Выгружаем все таблицы
  for (const table of TABLES) {
    try {
      // supabase .select() по умолчанию отдаёт до 1000 строк.
      // Если данных станет больше — нужно будет пагинировать. Пока — хватит.
      const { data, error } = await supabase.from(table).select('*');

      if (error) {
        errors.push(`${table}: ${error.message}`);
        backup.tables[table] = { count: 0, rows: [] };
      } else {
        backup.tables[table] = {
          count: (data || []).length,
          rows: data || [],
        };
      }
    } catch (e) {
      errors.push(`${table}: ${(e as Error).message}`);
      backup.tables[table] = { count: 0, rows: [] };
    }
  }

  // audit_log — ограниченный бэкап (5000 последних)
  try {
    const { data: auditData, error: auditErr } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (auditErr) {
      errors.push(`audit_log: ${auditErr.message}`);
    } else {
      backup.tables['audit_log'] = {
        count: (auditData || []).length,
        rows: auditData || [],
      };
    }
  } catch (e) {
    errors.push(`audit_log: ${(e as Error).message}`);
  }

  // Мета: список таблиц и общее число строк
  const totalRows = Object.values(backup.tables).reduce(
    (sum, t) => sum + t.count,
    0
  );
  const totalTables = Object.keys(backup.tables).length;

  backup.meta = {
    total_tables: totalTables,
    total_rows: totalRows,
    errors,
    duration_ms: Date.now() - startedAt,
  };

  // Имя файла: backup_YYYY-MM-DD_HHMM.json
  const now = new Date();
  const datePart = now.toISOString().split('T')[0];
  const timePart = now.toISOString().slice(11, 16).replace(':', '');
  const filename = `backup_${datePart}_${timePart}.json`;

  const fileContent = JSON.stringify(backup, null, 2);
  const sizeKb = Math.round((fileContent.length / 1024) * 10) / 10;

  // Отправляем в Telegram
  const caption = [
    `🗄 <b>Бэкап Logistics CRM</b>`,
    `📅 ${datePart} ${now.toISOString().slice(11, 16)} UTC`,
    `📊 Таблиц: ${totalTables}, строк: ${totalRows}`,
    `📦 Размер: ~${sizeKb} KB`,
    errors.length > 0 ? `⚠️ Ошибок: ${errors.length}` : `✅ Ошибок нет`,
  ].join('\n');

  const sent = await sendTelegramDocument(filename, fileContent, caption);

  return NextResponse.json({
    ok: sent,
    filename,
    tables: totalTables,
    rows: totalRows,
    size_kb: sizeKb,
    errors,
    duration_ms: Date.now() - startedAt,
  });
}
