import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { sendCronAlert, sendCronSummary } from '../../../../lib/cron-alert';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Размер страницы при пагинации (Supabase лимит по умолчанию — 1000)
const PAGE_SIZE = 1000;

// Защита от бесконечного цикла (если таблица вдруг начнёт расти быстрее, чем мы её читаем)
const MAX_PAGES = 100; // 100 * 1000 = 100 000 строк на таблицу

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

/**
 * Выгружает все строки таблицы порциями по PAGE_SIZE, обходя лимит 1000.
 * Возвращает массив всех строк и количество прочитанных страниц.
 */
async function fetchAllRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string
): Promise<{ rows: unknown[]; pages: number; truncated: boolean }> {
  const rows: unknown[] = [];
  let page = 0;

  while (page < MAX_PAGES) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      break;
    }

    rows.push(...data);

    // Если получили меньше PAGE_SIZE — это последняя страница
    if (data.length < PAGE_SIZE) {
      break;
    }

    page++;
  }

  // Если вышли из цикла по MAX_PAGES, но последняя страница была полной —
  // значит, возможно, данных больше, чем мы прочитали
  const truncated = page >= MAX_PAGES;

  return { rows, pages: page + 1, truncated };
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

  try {
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
    const truncatedTables: string[] = [];

    // Выгружаем все таблицы с пагинацией
    for (const table of TABLES) {
      try {
        const { rows, truncated } = await fetchAllRows(supabase, table);

        backup.tables[table] = {
          count: rows.length,
          rows,
        };

        if (truncated) {
          truncatedTables.push(table);
          errors.push(
            `${table}: достигнут лимит ${MAX_PAGES * PAGE_SIZE} строк, возможна потеря данных`
          );
        }
      } catch (e) {
        errors.push(`${table}: ${(e as Error).message}`);
        backup.tables[table] = { count: 0, rows: [] };
      }
    }

    // audit_log — ограниченный бэкап (5000 последних, без пагинации)
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
      truncated_tables: truncatedTables,
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

    // Алерты
    if (!sent) {
      await sendCronAlert(
        'backup',
        'Не удалось отправить дамп в Telegram (sendDocument вернул false). Проверь TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.'
      );
    } else if (errors.length > 0) {
      const preview = errors.slice(0, 10).map((e) => `• ${e}`).join('\n');
      const more = errors.length > 10 ? `\n…и ещё ${errors.length - 10}` : '';
      await sendCronSummary(
        'backup',
        `Проблемы при выгрузке (${errors.length}):\n${preview}${more}`
      );
    }

    return NextResponse.json({
      ok: sent,
      filename,
      tables: totalTables,
      rows: totalRows,
      size_kb: sizeKb,
      errors,
      truncated_tables: truncatedTables,
      duration_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const msg = (e as Error).message || 'unknown error';
    await sendCronAlert('backup', `Неожиданная ошибка: ${msg}`);
    return NextResponse.json(
      { ok: false, error: msg, duration_ms: Date.now() - startedAt },
      { status: 500 }
    );
  }
}
