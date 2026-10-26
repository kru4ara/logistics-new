import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase-server';
import { sendCronAlert } from '../../../../lib/cron-alert';

export const dynamic = 'force-dynamic';

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

  try {
    const supabase = await createClient();

    // Начало сегодняшнего дня (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('audit_log')
      .select('id, created_at, summary')
      .eq('user_name', 'Cron')
      .eq('entity_type', 'trip')
      .gte('created_at', todayStart.toISOString())
      .ilike('summary', 'Бэкап выполнен%')
      .limit(1);

    if (error) {
      await sendCronAlert('backup-watch', `Ошибка запроса audit_log: ${error.message}`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      await sendCronAlert(
        'backup-watch',
        '⚠️ Бэкап за сегодня не обнаружен! Проверь Vercel Cron и CRON_SECRET.'
      );
      return NextResponse.json({ ok: false, message: 'Бэкап не найден' });
    }

    return NextResponse.json({ ok: true, message: 'Бэкап за сегодня есть', at: data[0].created_at });
  } catch (e) {
    const msg = (e as Error).message || 'unknown error';
    await sendCronAlert('backup-watch', `Неожиданная ошибка: ${msg}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
