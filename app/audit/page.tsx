import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';

export const dynamic = 'force-dynamic';

const ENTITY_LABELS: Record<string, string> = {
  trip: 'Рейс',
  client: 'Клиент',
  driver: 'Водитель',
  contractor: 'Подрядчик',
  location: 'Локация',
  forwarding_order: 'Экспедирование',
  trip_expense: 'Расход рейса',
  forwarding_expense: 'Расход экспедиции',
  document: 'Документ',
  reminder: 'Напоминание',
};

const ACTION_LABELS: Record<string, { text: string; color: string }> = {
  create: { text: 'Создано', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  update: { text: 'Изменено', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  delete: { text: 'Удалено', color: 'bg-red-50 text-red-700 border-red-200' },
  status_change: { text: 'Смена статуса', color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const FIELD_LABELS: Record<string, string> = {
  // Рейс
  revenue_eur: 'Фрахт (€)',
  driver_id: 'Водитель',
  truck_id: 'Тягач',
  client_id: 'Клиент',
  start_date: 'Дата старта',
  end_date: 'Дата финиша',
  route: 'Маршрут',
  client_request_number: '№ заявки клиента',
  start_fuel_level: 'Остаток топлива (л)',
  status: 'Статус',
  // Клиент
  name: 'Название',
  contact_person: 'Контактное лицо',
  phone: 'Телефон',
  email: 'Email',
};

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'start_date' || field === 'end_date') {
    try {
      return new Date(String(value)).toLocaleDateString('ru-RU');
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hh}:${mm}`;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { entity?: string };
}) {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');
  if (role !== 'admin') redirect('/login');

  const supabase = await createClient();

  const entityFilter = searchParams.entity || null;

  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (entityFilter) {
    query = query.eq('entity_type', entityFilter);
  }

  const { data: logs, error } = await query;

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Ошибка загрузки журнала: {error.message}
      </div>
    );
  }

  const allEntities = Object.keys(ENTITY_LABELS);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">📜 Журнал изменений</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Кто, что и когда менял в системе
          </p>
        </div>

        {/* Фильтры по типу сущности */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/audit"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${!entityFilter
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'}`}
          >
            Все
          </a>
          {allEntities.map((key) => (
            <a
              key={key}
              href={`/audit?entity=${key}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${entityFilter === key
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'}`}
            >
              {ENTITY_LABELS[key]}
            </a>
          ))}
        </div>

        {(!logs || logs.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 md:p-16 text-center">
            <div className="text-5xl md:text-6xl mb-4">📭</div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Записей пока нет</h2>
            <p className="text-slate-500 text-sm">
              Как только кто-то создаст, изменит или удалит рейс — запись появится здесь
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const actionInfo = ACTION_LABELS[log.action] || {
                text: log.action,
                color: 'bg-slate-100 text-slate-700 border-slate-200',
              };
              const entityLabel = ENTITY_LABELS[log.entity_type] || log.entity_type;

              // Разбираем changes, если есть
              const changes = log.changes as Record<string, { before: unknown; after: unknown }> | null;

              return (
                <div
                  key={log.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${actionInfo.color}`}>
                        {actionInfo.text}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        {entityLabel}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </span>
                  </div>

                  {log.summary && (
                    <div className="text-sm text-slate-800 font-medium mb-2 break-words">
                      {log.summary}
                    </div>
                  )}

                  {changes && Object.keys(changes).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                      {Object.entries(changes).map(([field, { before, after }]) => (
                        <div key={field} className="flex flex-wrap items-baseline gap-2 text-xs">
                          <span className="text-slate-500 font-medium">
                            {FIELD_LABELS[field] || field}:
                          </span>
                          <span className="text-red-500 line-through">
                            {formatFieldValue(field, before)}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-600 font-semibold">
                            {formatFieldValue(field, after)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
                    <span>👤</span>
                    <span className="font-medium text-slate-500">{log.user_name}</span>
                    {log.user_role && (
                      <span className="text-slate-300">·</span>
                    )}
                    {log.user_role && (
                      <span>
                        {log.user_role === 'admin' ? 'Офис' : log.user_role === 'driver' ? 'Водитель' : log.user_role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
