import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { globalSearch, type SearchHit } from './actions';
import {
  Search as SearchIcon,
  Package,
  Boxes,
  Users,
  Building2,
  UserCircle,
  ArrowRight,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function Section({
  title,
  Icon,
  hits,
  href,
}: {
  title: string;
  Icon: LucideIcon;
  hits: SearchHit[];
  href: string;
}) {
  if (hits.length === 0) return null;
  return (
    <div className="card overflow-hidden">
      <Link
        href={href}
        className="px-5 py-3 border-b border-slate-100 flex items-center gap-2 hover:bg-slate-50 transition-colors group"
      >
        <Icon className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={2.2} />
        <span className="font-semibold text-slate-700 group-hover:text-brand-600 transition-colors">{title}</span>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold tabular-nums">
          {hits.length}
        </span>
      </Link>
      <div className="divide-y divide-slate-100">
        {hits.map((h) => (
          <Link
            key={h.domain + h.id}
            href={h.href}
            className="group/row block px-5 py-3 hover:bg-brand-50/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-brand-600" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-800 break-words group-hover/row:text-brand-600 transition-colors">
                  {h.title}
                </div>
                {h.subtitle && (
                  <div className="text-xs text-slate-500 mt-0.5 break-words">{h.subtitle}</div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover/row:text-brand-500
                                       group-hover/row:translate-x-0.5 transition-all shrink-0 mt-1" strokeWidth={2.5} />
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <SearchIcon className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Поиск
          </h1>
          {q && (
            <p className="text-slate-500 mt-1 text-sm">
              По запросу «<b className="text-slate-700">{q}</b>» найдено: <b className="text-slate-700 tabular-nums">{result.total}</b>
            </p>
          )}
        </div>

        {!q && (
          <div className="card p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-brand-50 flex items-center justify-center">
              <SearchIcon className="w-8 h-8 text-brand-500" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Введите запрос</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Ищите по номеру рейса, заявки, названию клиента, фамилии водителя или подрядчика
            </p>
          </div>
        )}

        {q && q.length < 2 && (
          <div className="card p-6 text-center text-slate-500 text-sm">
            Минимум 2 символа для поиска
          </div>
        )}

        {q && q.length >= 2 && result.total === 0 && (
          <div className="card p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Ничего не найдено</h2>
            <p className="text-slate-500 text-sm">Попробуйте другой запрос</p>
          </div>
        )}

        <Section title="Рейсы" Icon={Package} hits={result.trips} href="/trips" />
        <Section title="Экспедирование" Icon={Boxes} hits={result.forwarding} href="/forwarding" />
        <Section title="Клиенты" Icon={Users} hits={result.clients} href="/clients" />
        <Section title="Подрядчики" Icon={Building2} hits={result.contractors} href="/contractors" />
        <Section title="Водители" Icon={UserCircle} hits={result.drivers} href="/drivers" />

      </div>
    </main>
  );
}
