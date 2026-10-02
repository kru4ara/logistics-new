import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { globalSearch, type SearchHit } from './actions';

export const dynamic = 'force-dynamic';

function Section({
  title,
  icon,
  hits,
}: {
  title: string;
  icon: string;
  hits: SearchHit[];
}) {
  if (hits.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-slate-700">{title}</span>
        <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
          {hits.length}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {hits.map((h) => (
          <Link
            key={h.domain + h.id}
            href={h.href}
            className="block px-5 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">{h.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800 break-words">{h.title}</div>
                {h.subtitle && (
                  <div className="text-xs text-slate-500 mt-0.5 break-words">{h.subtitle}</div>
                )}
              </div>
              <span className="text-slate-400 text-sm shrink-0">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const role = cookies().get('role')?.value;
  if (role !== 'admin') redirect('/');

  const q = (searchParams.q || '').trim();
  const result = await globalSearch(q);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5">

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">🔍 Поиск</h1>
          {q && (
            <p className="text-slate-500 mt-1 text-sm">
              По запросу «<b className="text-slate-700">{q}</b>» найдено: <b>{result.total}</b>
            </p>
          )}
        </div>

        {!q && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Введите запрос</h2>
            <p className="text-slate-500 text-sm">
              Ищите по номеру рейса, заявки, названию клиента, фамилии водителя или подрядчика
            </p>
          </div>
        )}

        {q && q.length < 2 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-500 text-sm">
            Минимум 2 символа для поиска
          </div>
        )}

        {q && q.length >= 2 && result.total === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
            <div className="text-5xl mb-3">📭</div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Ничего не найдено</h2>
            <p className="text-slate-500 text-sm">Попробуйте другой запрос</p>
          </div>
        )}

        <Section title="Рейсы" icon="📋" hits={result.trips} />
        <Section title="Экспедирование" icon="📦" hits={result.forwarding} />
        <Section title="Клиенты" icon="🤝" hits={result.clients} />
        <Section title="Подрядчики" icon="🏢" hits={result.contractors} />
        <Section title="Водители" icon="🚛" hits={result.drivers} />

      </div>
    </main>
  );
}
