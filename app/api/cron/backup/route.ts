import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/admin';
import { sendCronAlert, sendCronSummary } from '../../../../lib/cron-alert';
import { fetchAll } from '../../../../lib/fetch-all';
import { encryptBackup, parseBackupKey } from '../../../../lib/backup-crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Предохранитель: больше строк в одной таблице — ошибка в отчёте бэкапа.
const MAX_ROWS_PER_TABLE = 100_000;

// Telegram принимает от бота документы до 50 МБ.
const TELEGRAM_MAX_BYTES = 49 * 1024 * 1024;

// Таблицы для бэкапа: все ключевые данные.
// audit_log — ограничим 5000 последних, чтобы файл не раздувался.
// driver_telegram_links не бэкапим: одноразовые токены на 24 часа.
const TABLES = [
  'clients',
  'contractors',
  'drivers',
  'trucks',
  'locations',
  'trips',
  'trip_cargo',
  'trip_segments',
  'trip_segment_cargo',
  'trip_expenses',
  'trip_documents',
  'forwarding_orders',
  'forwarding_contractors',
  'forwarding_points',
  'forwarding_expenses',
  'reminders',
  'rates',
  'documents',
  'fixed_costs',
  // Без них из бэкапа не восстановить роли, менеджеров, балансы водителей
  // и нумерацию заказов (до фазы 43 в бэкап не попадали).
  'profiles',
  'managers',
  'driver_transactions',
  'trip_counter',
  'users',
];

// Колонка стабильной сортировки при постраничном чтении (по умолчанию id).
const TIE_BREAKER: Record<string, string> = {
  rates: 'rate_date',
};

async function sendTelegramDocument(
  filename: string,
  fileContent: Buffer,
  caption: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[backup] Telegram env not set');
    return false;
  }

  try {
    const blob = new Blob([new Uint8Array(fileContent)], { type: 'application/octet-stream' });
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
  // Защита: CRON_SECRET обязателен
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured on the server' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  // Без ключа шифрования бэкап НЕ отправляем: в открытом виде в Telegram
  // уходили бы персональные данные водителей и клиентов.
  let key: Buffer;
  try {
    key = parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);
  } catch (e) {
    const msg = (e as Error).message;
    await sendCronAlert('backup', `Бэкап не выполнен: ${msg}. Добавь ключ в Vercel → Environment Variables.`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

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

    // Выгружаем все таблицы с пагинацией
    for (const table of TABLES) {
      try {
        // fetchAll читает страницами со стабильной сортировкой: без неё
        // PostgreSQL вправе отдавать строки в разном порядке, и на границах
        // страниц строки дублировались или терялись.
        const { data, error } = await fetchAll(supabase.from(table).select('*'), {
          tieBreaker: TIE_BREAKER[table] ?? 'id',
          maxRows: MAX_ROWS_PER_TABLE,
        });
        if (error) throw new Error(error.message);

        backup.tables[table] = { count: data.length, rows: data };
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
      duration_ms: Date.now() - startedAt,
    };

    // Имя файла: backup_YYYY-MM-DD_HHMM.json.gz.enc
    // Расшифровка: scripts/decrypt-backup.mjs
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const timePart = now.toISOString().slice(11, 16).replace(':', '');
    const filename = `backup_${datePart}_${timePart}.json.gz.enc`;

    // JSON без отступов: отступы раздували файл, а читает его скрипт.
    const fileContent = encryptBackup(JSON.stringify(backup), key);
    const sizeKb = Math.round((fileContent.length / 1024) * 10) / 10;

    if (fileContent.length > TELEGRAM_MAX_BYTES) {
      const msg = `Файл бэкапа ${sizeKb} KB больше лимита Telegram (50 МБ) — бэкап не отправлен. Нужно другое хранилище.`;
      await sendCronAlert('backup', msg);
      return NextResponse.json({ ok: false, error: msg, size_kb: sizeKb }, { status: 500 });
    }

    // Отправляем в Telegram
    const caption = [
      `🗄 <b>Бэкап Logistics CRM</b>`,
      `📅 ${datePart} ${now.toISOString().slice(11, 16)} UTC`,
      `📊 Таблиц: ${totalTables}, строк: ${totalRows}`,
      `📦 Размер: ~${sizeKb} KB (сжат и зашифрован)`,
      errors.length > 0 ? `⚠️ Ошибок: ${errors.length}` : `✅ Ошибок нет`,
    ].join('\n');

    const sent = await sendTelegramDocument(filename, fileContent, caption);

    // ⬅️ Записываем факт успешного бэкапа в audit_log (для сторожа)
    if (sent) {
      try {
        await supabase.from('audit_log').insert([{
          user_role: 'system',
          user_id: null,
          user_name: 'Cron',
          entity_type: 'trip',
          entity_id: '00000000-0000-0000-0000-000000000000',
          action: 'create',
          summary: `Бэкап выполнен: ${filename} (${totalRows} строк, ${sizeKb} KB)`,
        }]);
      } catch (auditErr) {
        console.error('[backup] audit_log insert failed:', auditErr);
      }
    }

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
