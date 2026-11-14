import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
// @ts-expect-error — .mjs без типов
import { validateOptions, nextSteps, STEPS, generateSecrets, buildEnv, poolerUrl, mask, VERCEL_REGION } from '../../scripts/provision-plan.mjs';

type EnvVar = { key: string; value: string; type: string };
const opts = { name: 'acme', region: 'eu-central-1', officeEmail: 'office@acme.pl', domain: 'crm.example.com' };

describe('развёртывание клиента: план', () => {
  it('проверяет имя, регион ЕС, e-mail и домен', () => {
    expect(validateOptions(opts)).toEqual([]);
    const errs = validateOptions({ name: 'Acme!', region: 'us-east-1', officeEmail: 'x', domain: '' });
    expect(errs).toHaveLength(4);
    expect(errs[1]).toContain('только ЕС');
  });

  it('регион функций Vercel совпадает с регионом базы', () => {
    expect(VERCEL_REGION['eu-west-1']).toBe('dub1');
    expect(VERCEL_REGION['eu-central-1']).toBe('fra1');
  });

  it('продолжает с места сбоя', () => {
    expect(nextSteps({ done: [] })).toEqual(STEPS);
    expect(nextSteps({ done: STEPS.slice(0, 4) })[0]).toBe('database');
  });

  it('секреты нужной длины: ключ бэкапа — ровно 32 байта', () => {
    const s = generateSecrets(randomBytes);
    expect(Buffer.from(s.backupKey, 'base64')).toHaveLength(32);
    expect(s.cronSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(s.dbPassword.length).toBeGreaterThanOrEqual(30);
  });

  it('переменные окружения: секреты зашифрованы, Telegram и оповещения — только если заданы', () => {
    const s = { supabaseUrl: 'https://ref.supabase.co', anonKey: 'anon', serviceKey: 'svc', secrets: generateSecrets(randomBytes) };
    const env: EnvVar[] = buildEnv(opts, s, {});
    const keys = env.map((e) => e.key);
    expect(env.find((e) => e.key === 'NEXT_PUBLIC_APP_URL')?.value).toBe('https://acme.crm.example.com');
    expect(env.find((e) => e.key === 'SUPABASE_SERVICE_ROLE_KEY')?.type).toBe('encrypted');
    expect(keys).not.toContain('TELEGRAM_BOT_TOKEN');
    expect(keys).not.toContain('OPS_TELEGRAM_BOT_TOKEN');
    const full = (buildEnv({ ...opts, telegramToken: '123:abc' }, s, { OPS_TELEGRAM_BOT_TOKEN: 't', OPS_TELEGRAM_CHAT_ID: '1' }) as EnvVar[]).map((e) => e.key);
    expect(full).toEqual(expect.arrayContaining(['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'OPS_TELEGRAM_BOT_TOKEN']));
  });

  it('строка pooler: сессионный порт и пароль с экранированием', () => {
    const url = poolerUrl(
      [{ database_type: 'PRIMARY', connection_string: 'postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres' }],
      'p@ss/word',
    );
    expect(url).toBe('postgresql://postgres.abc:p%40ss%2Fword@aws-0-eu-central-1.pooler.supabase.com:5432/postgres');
    expect(poolerUrl([], 'x')).toBeNull();
    expect(mask('abcdefghij')).toBe('abc…ij');
  });

  it('пробный прогон ничего не создаёт и не требует токенов', () => {
    const r = spawnSync(process.execPath, [resolve(__dirname, '../../scripts/provision-tenant.mjs'),
      '--name', 'drytest', '--domain', 'crm.example.com', '--office-email', 'o@x.pl', '--dry-run'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('supabase-project');
    expect(r.stdout).toContain('NEXT_PUBLIC_APP_URL = https://drytest.crm.example.com');
    expect(r.stdout).not.toMatch(/BACKUP_ENCRYPTION_KEY = [A-Za-z0-9+/]{40}/);
  });
});
