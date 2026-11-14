// Чистая логика сводки по клиентам — без базы, для юнит-тестов.
// Используется scripts/tenants-status.mjs.

/** Бэкап делается раз в сутки (cron 07:00 UTC); старше этого — тревога. */
export const BACKUP_MAX_AGE_H = 26;

/**
 * Оценить одну базу.
 * @param s { error?, pending, changed, lastBackupAt: Date|null, now: Date }
 * @returns { level: 'ok'|'warn'|'fail', notes: string[] }
 */
export function assessTenant(s) {
  if (s.error) return { level: 'fail', notes: [`нет связи: ${s.error}`] };
  const notes = [];
  let level = 'ok';
  const bump = (l) => { if (l === 'fail' || (l === 'warn' && level === 'ok')) level = l; };

  if (!s.lastBackupAt) {
    notes.push('бэкапов не было');
    bump('fail');
  } else {
    const ageH = (s.now - s.lastBackupAt) / 3_600_000;
    if (ageH > BACKUP_MAX_AGE_H) {
      notes.push(`бэкап ${Math.floor(ageH / 24)} дн. назад`);
      bump('fail');
    }
  }
  if (s.pending > 0) {
    notes.push(`не применено миграций: ${s.pending}`);
    bump('warn');
  }
  if (s.changed > 0) {
    notes.push(`изменены применённые миграции: ${s.changed}`);
    bump('warn');
  }
  return { level, notes };
}

export function ago(date, now) {
  if (!date) return '—';
  const h = (now - date) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} мин`;
  if (h < 48) return `${Math.round(h)} ч`;
  return `${Math.round(h / 24)} дн`;
}

const ICON = { ok: '✅', warn: '⚠️', fail: '❌' };

/** Таблица для терминала. rows: [{ name, level, version, backup, trips, drivers, users, lastLogin, notes }] */
export function formatTable(rows) {
  const head = ['', 'клиент', 'схема', 'бэкап', 'заказов', 'водителей', 'польз.', 'вход', 'замечания'];
  const body = rows.map((r) => [ICON[r.level], r.name, r.version, r.backup, String(r.trips ?? '—'), String(r.drivers ?? '—'), String(r.users ?? '—'), r.lastLogin, r.notes.join('; ')]);
  const all = [head, ...body];
  const width = head.map((_, i) => Math.max(...all.map((row) => [...row[i]].length)));
  return all.map((row) => row.map((c, i) => c + ' '.repeat(width[i] - [...c].length)).join('  ').trimEnd()).join('\n');
}
