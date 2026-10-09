import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { deleteContractor } from './actions';
import CountryFlag from '../components/CountryFlag';
import {
  Building2,
  Plus,
  Phone,
  Mail,
  User as UserIcon,
  MapPin,
  FileText,
  Package,
  Truck,
  ArrowRight,
  Pencil,
  Trash2,
  Inbox,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ContractorsPage() {
  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: contractors, error } = await supabase
    .from('contractors')
    .select('*')
    .order('name');

  if (error) {
    return <div className="p-8 text-red-500">Ошибка загрузки: {error.message}</div>;
  }

  // Считаем сколько заявок экспедирования у каждого подрядчика
  const { data: allFc } = await supabase
    .from('forwarding_contractors')
    .select('contractor_id');

  const ordersCountByContractor: Record<string, number> = {};
  allFc?.forEach((fc) => {
    if (!fc.contractor_id) return;
    ordersCountByContractor[fc.contractor_id] =
      (ordersCountByContractor[fc.contractor_id] || 0) + 1;
  });

  // Считаем сколько комбинированных рейсов у каждого подрядчика
  const { data: allTs } = await supabase
    .from('trip_subcontractors')
    .select('contractor_id');

  const tripsCountByContractor: Record<string, number> = {};
  allTs?.forEach((ts) => {
    if (!ts.contractor_id) return;
    tripsCountByContractor[ts.contractor_id] =
      (tripsCountByContractor[ts.contractor_id] || 0) + 1;
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
              <Building2 className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
              Подрядчики
            </h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Всего: <b className="text-slate-700">{contractors?.length || 0}</b> фирм
            </p>
          </div>
          <a
            href="/contractors/new"
            className="btn btn-primary text-sm md:text-base w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={2.5} />
            Добавить подрядчика
          </a>
        </div>

        {(!contractors || contractors.length === 0) ? (
          <div className="card p-10 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Подрядчиков пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первого, чтобы передавать им грузы</p>
            <a href="/contractors/new" className="btn btn-primary inline-flex">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Добавить подрядчика
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {contractors.map((c) => {
              const ordersCount = ordersCountByContractor[c.id] || 0;
              const tripsCount = tripsCountByContractor[c.id] || 0;
              const totalWorks = ordersCount + tripsCount;

              return (
                <div
                  key={c.id}
                  className="group card card-hover overflow-hidden flex flex-col"
                >
                  {/* Кликабельная часть — переход в карточку */}
                  <a
                    href={`/contractors/${c.id}`}
                    className="block flex-1 cursor-pointer"
                    aria-label={`Открыть карточку ${c.name}`}
                  >
                    {/* Шапка карточки */}
                    <div className="p-5 border-b border-slate-100 relative">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500
                                        flex items-center justify-center shrink-0 shadow-brand">
                          <Building2 className="w-6 h-6 text-white" strokeWidth={2.2} />
                        </div>
                        <div className="min-w-0 flex-1 pr-5">
                          <div className="font-bold text-slate-900 break-words group-hover:text-brand-600 transition-colors">
                            {c.name}
                          </div>
                          {c.full_name && c.full_name !== c.name && (
                            <div className="text-xs text-slate-500 mt-1 break-words leading-snug">
                              {c.full_name}
                            </div>
                          )}
                          {c.country && (
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              <CountryFlag country={c.country} />
                              <span>{c.country}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Стрелка — намёк на кликабельность */}
                      <div className="absolute top-5 right-4">
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500
                                                group-hover:translate-x-0.5 transition-all" strokeWidth={2.5} />
                      </div>

                      {totalWorks > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {ordersCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                             bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-semibold">
                              <Package className="w-3 h-3" strokeWidth={2.2} />
                              {ordersCount} {ordersCount === 1 ? 'заявка' : ordersCount < 5 ? 'заявки' : 'заявок'}
                            </span>
                          )}
                          {tripsCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                                             bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                              <Truck className="w-3 h-3" strokeWidth={2.2} />
                              {tripsCount} {tripsCount === 1 ? 'рейс' : tripsCount < 5 ? 'рейса' : 'рейсов'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Контакты и юр. данные */}
                    <div className="p-5 space-y-2.5 text-sm">
                      {c.contact_person && (
                        <div className="flex items-start gap-2 text-slate-700">
                          <UserIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="break-words">{c.contact_person}</span>
                        </div>
                      )}

                      {c.phone && (
                        <div className="flex items-start gap-2">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="text-slate-700 break-all tabular-nums">{c.phone}</span>
                        </div>
                      )}

                      {c.email && (
                        <div className="flex items-start gap-2">
                          <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="text-slate-600 break-all text-xs">{c.email}</span>
                        </div>
                      )}

                      {c.tax_id && (
                        <div className="flex items-start gap-2 text-slate-600">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="break-words text-xs">
                            NIP: <b className="tabular-nums">{c.tax_id}</b>
                          </span>
                        </div>
                      )}

                      {c.address && (
                        <div className="flex items-start gap-2 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" strokeWidth={2} />
                          <span className="break-words text-xs">{c.address}</span>
                        </div>
                      )}

                      {c.notes && (
                        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 mt-3 break-words">
                          {c.notes}
                        </div>
                      )}

                      {!c.contact_person && !c.phone && !c.email && !c.tax_id && !c.address && !c.notes && (
                        <div className="text-xs text-slate-400 italic text-center py-4">
                          Контактные данные не заполнены
                        </div>
                      )}
                    </div>
                  </a>

                  {/* Кнопки — вне ссылки */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/40 flex gap-2">
                    <a
                      href={`/contractors/${c.id}/edit`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                                 hover:bg-white transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                      Изменить
                    </a>
                    <form action={deleteContractor.bind(null, c.id)} className="flex-1">
                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                   text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        Удалить
                      </button>
                    </form>
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
