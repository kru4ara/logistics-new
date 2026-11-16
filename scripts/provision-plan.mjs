// Чистая логика развёртывания новой компании — без сети, для юнит-тестов.
// Используется scripts/provision-tenant.mjs.

/** Регион базы Supabase → ближайший регион функций Vercel (тот же регион AWS). */
export const VERCEL_REGION = {
  'eu-west-1': 'dub1', // Ирландия
  'eu-central-1': 'fra1', // Франкфурт
  'eu-west-2': 'lhr1', // Лондон
  'eu-west-3': 'cdg1', // Париж
  'eu-north-1': 'arn1', // Стокгольм
};

export const EU_REGIONS = Object.keys(VERCEL_REGION);

/** Короткое имя клиента: латиница, цифры, дефис; оно же — поддомен и имя проектов. */
export function validateName(name) {
  if (!name) return 'нужно имя клиента: --name acme';
  if (!/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(name)) {
    return 'имя — 3–30 символов: строчная латиница, цифры, дефис; начинается с буквы';
  }
  return null;
}

export function validateOptions(o) {
  const errors = [];
  const nameErr = validateName(o.name);
  if (nameErr) errors.push(nameErr);
  if (!EU_REGIONS.includes(o.region)) errors.push(`регион — только ЕС (RODO): ${EU_REGIONS.join(', ')}`);
  if (!o.officeEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.officeEmail)) errors.push('нужен e-mail офиса: --office-email');
  if (!o.domain) errors.push('нужен домен для клиентов: --domain crm.example.com');
  return errors;
}

/** Порядок шагов. Каждый пишет результат в файл состояния — повторный запуск продолжает с места сбоя. */
export const STEPS = [
  'supabase-project',   // проект в ЕС, пароль базы
  'supabase-ready',     // ждём ACTIVE_HEALTHY
  'supabase-keys',      // anon / service_role
  'supabase-auth',      // запрет самостоятельной регистрации
  'database',           // все миграции + журнал
  'office-user',        // первый пользователь офиса, роль office
  'company',            // строка company_settings с названием
  'vercel-project',     // проект из репозитория, регион функций, переменные
  'vercel-domain',      // <name>.<domain>
  'vercel-deploy',      // первый деплой из master
  'telegram-webhook',   // только если передан токен бота клиента
  'tenants-file',       // добавить в scripts/tenants.json
];

export function nextSteps(state) {
  const done = new Set(state.done || []);
  return STEPS.filter((s) => !done.has(s));
}

/** Секреты, которые генерирует скрипт. rand(n) → Buffer из n случайных байт. */
export function generateSecrets(rand) {
  return {
    dbPassword: rand(24).toString('base64url'),
    officePassword: rand(12).toString('base64url'),
    cronSecret: rand(32).toString('hex'),
    backupKey: rand(32).toString('base64'), // ровно 32 байта — иначе бэкап откажется (см. lib/backup-crypto.ts)
    telegramWebhookSecret: rand(32).toString('hex'),
  };
}

export function appUrl(o) {
  return `https://${o.name}.${o.domain}`;
}

/** Переменные окружения проекта Vercel. Секретные — type 'encrypted'. */
export function buildEnv(o, s, ops = {}) {
  const env = [
    ['NEXT_PUBLIC_SUPABASE_URL', s.supabaseUrl, 'plain'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', s.anonKey, 'plain'],
    ['SUPABASE_SERVICE_ROLE_KEY', s.serviceKey, 'encrypted'],
    ['NEXT_PUBLIC_APP_URL', appUrl(o), 'plain'],
    ['CRON_SECRET', s.secrets.cronSecret, 'encrypted'],
    ['BACKUP_ENCRYPTION_KEY', s.secrets.backupKey, 'encrypted'],
    ['TENANT_NAME', o.name, 'plain'],
  ];
  if (o.telegramToken) {
    env.push(['TELEGRAM_BOT_TOKEN', o.telegramToken, 'encrypted']);
    env.push(['TELEGRAM_WEBHOOK_SECRET', s.secrets.telegramWebhookSecret, 'encrypted']);
  }
  if (o.telegramChatId) env.push(['TELEGRAM_CHAT_ID', o.telegramChatId, 'plain']);
  if (ops.OPS_TELEGRAM_BOT_TOKEN && ops.OPS_TELEGRAM_CHAT_ID) {
    env.push(['OPS_TELEGRAM_BOT_TOKEN', ops.OPS_TELEGRAM_BOT_TOKEN, 'encrypted']);
    env.push(['OPS_TELEGRAM_CHAT_ID', ops.OPS_TELEGRAM_CHAT_ID, 'plain']);
  }
  return env
    .filter(([, value]) => value)
    .map(([key, value, type]) => ({ key, value, type, target: ['production', 'preview'] }));
}

/** Строка подключения из ответа pooler-конфига: сессионный режим (порт 5432), пароль подставлен. */
export function poolerUrl(poolerConfig, password) {
  const list = Array.isArray(poolerConfig) ? poolerConfig : [poolerConfig];
  const primary = list.find((p) => p && p.database_type === 'PRIMARY') || list[0];
  const raw = primary?.connection_string || primary?.connectionString;
  if (!raw) return null;
  const url = new URL(raw.replace('[YOUR-PASSWORD]', 'x'));
  url.password = encodeURIComponent(password);
  if (url.port === '6543') url.port = '5432'; // транзакционный режим → сессионный (миграциям нужен он)
  return url.toString();
}

/** Скрыть секреты при печати плана (--dry-run). */
export function mask(value) {
  if (typeof value !== 'string' || value.length < 8) return '***';
  return `${value.slice(0, 3)}…${value.slice(-2)}`;
}

/**
 * Итог развёртывания для владельца (личный Telegram OPS): вход клиента, строка для
 * TENANTS_JSON (миграции), ключ бэкапов. Только то, без чего не обойтись; остальное —
 * в зашифрованном состоянии (артефакт workflow «Provision tenant»).
 */
export function buildReport(o, s) {
  const lines = [
    `✅ Новый клиент: ${o.name}`,
    `CRM: ${appUrl(o)}`,
    `DNS у регистратора: CNAME ${o.name} → cname.vercel-dns.com`,
    '',
    `Вход офиса: ${o.officeEmail}`,
    `Пароль: ${s.secrets?.officePassword ?? '—'} (попросите сменить после входа)`,
    '',
    'Добавьте в секрет TENANTS_JSON (GitHub → Environments → migrations) элемент:',
    JSON.stringify({ name: o.name, url: s.databaseUrl ?? '' }),
    '',
    `Ключ расшифровки бэкапов: ${s.secrets?.backupKey ?? '—'}`,
    '',
    'Перенесите это в менеджер паролей и удалите сообщение.',
  ];
  return lines.join('\n');
}
