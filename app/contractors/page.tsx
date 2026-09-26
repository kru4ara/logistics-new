import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase-server';
import { deleteContractor } from './actions';

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

  // Считаем сколько заявок у каждого подрядчика
  const { data: allFc } = await supabase
    .from('forwarding_contractors')
    .select('contractor_id');

  const ordersCountByContractor: Record<string, number> = {};
  allFc?.forEach((fc) => {
    if (!fc.contractor_id) return;
    ordersCountByContractor[fc.contractor_id] =
      (ordersCountByContractor[fc.contractor_id] || 0) + 1;
  });

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">🏢 Подрядчики</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">
              Всего: <b>{contractors?.length || 0}</b> фирм
            </p>
          </div>
          <a
            href="/contractors/new"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white
                       font-semibold px-4 md:px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/20
                       transition-all duration-150 active:scale-[0.98] text-sm md:text-base"
          >
            <span>➕</span>
            <span>Добавить подрядчика</span>
          </a>
        </div>

        {(!contractors || contractors.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 md:p-16 text-center">
            <div className="text-5xl md:text-6xl mb-4">🏢</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Подрядчиков пока нет</h2>
            <p className="text-slate-500 mb-6">Добавьте первого, чтобы передавать им грузы</p>
            <a
              href="/contractors/new"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl"
            >
              ➕ Добавить подрядчика
            </a>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {contractors.map((c) => {
              const ordersCount = ordersCountByContractor[c.id] || 0;

              return (
                <div
                  key={c.id}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm
                             hover:shadow-xl hover:border-blue-200 transition-all duration-200 overflow-hidden
                             flex flex-col"
                >
                  {/* Шапка карточки */}
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700
                                      flex items-center justify-center text-white text-xl shrink-0">
                        🏢
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 break-words group-hover:text-blue-600 transition-colors">
                          {c.name}
                        </div>
                        {c.full_name && c.full_name !== c.name && (
                          <div className="text-xs text-slate-500 mt-1 break-words leading-snug">
                            {c.full_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {ordersCount > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                                      bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                        📦 {ordersCount} {ordersCount === 1 ? 'заявка' : ordersCount < 5 ? 'заявки' : 'заявок'}
                      </div>
                    )}
                  </div>

                  {/* Контакты и юр. данные */}
                  <div className="p-5 space-y-2.5 text-sm flex-1">
                    {c.contact_person && (
                      <div className="flex items-start gap-2 text-slate-700">
                        <span className="shrink-0">👤</span>
                        <span className="break-words">{c.contact_person}</span>
                      </div>
                    )}

                    {c.phone && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0">📞</span>
                        <a
                          href={`tel:${c.phone}`}
                          className="text-blue-600 hover:underline break-all"
                        >
                          {c.phone}
                        </a>
                      </div>
                    )}

                    {c.email && (
                      <div className="flex items-start gap-2">
                        <span className="shrink-0">✉️</span>
                        <a
                          href={`mailto:${c.email}`}
                          className="text-blue-600 hover:underline break-all text-xs"
                        >
                          {c.email}
                        </a>
                      </div>
                    )}

                    {c.tax_id && (
                      <div className="flex items-start gap-2 text-slate-600">
                        <span className="shrink-0">🏷️</span>
                        <span className="break-words text-xs">
                          NIP: <b>{c.tax_id}</b>
                        </span>
                      </div>
                    )}

                    {c.address && (
                      <div className="flex items-start gap-2 text-slate-600">
                        <span className="shrink-0">📍</span>
                        <span className="break-words text-xs">{c.address}</span>
                      </div>
                    )}

                    {c.notes && (
                      <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 mt-3 break-words">
                        📝 {c.notes}
                      </div>
                    )}

                    {/* Пустое состояние — если ничего не заполнено */}
                    {!c.contact_person && !c.phone && !c.email && !c.tax_id && !c.address && !c.notes && (
                      <div className="text-xs text-slate-400 italic text-center py-4">
                        Контактные данные не заполнены
                      </div>
                    )}
                  </div>

                  {/* Кнопки */}
                  <div className="p-3 border-t border-slate-100 bg-slate-50/40 flex gap-2">
                    <a
                      href={`/contractors/${c.id}/edit`}
                      className="flex-1 text-center px-3 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                                 hover:bg-white transition-all"
                    >
                      ✏️ Изменить
                    </a>
                    <form action={deleteContractor.bind(null, c.id)} className="flex-1">
                      <button
                        type="submit"
                        className="w-full px-3 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                   text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                      >
                        🗑️ Удалить
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
