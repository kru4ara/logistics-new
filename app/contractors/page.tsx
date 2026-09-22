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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        {/* Заголовок */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">🏢 Подрядчики</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Фирмы, которых мы нанимаем для экспедирования</p>
          </div>
          <a
            href="/contractors/new"
            className="flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold
                       shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98] text-sm md:text-base"
          >
            ➕ Добавить подрядчика
          </a>
        </div>

        {(!contractors || contractors.length === 0) ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 md:p-12 text-center">
            <div className="text-5xl mb-4">🏢</div>
            <p className="text-slate-500 mb-4">Пока нет ни одного подрядчика</p>
            <a
              href="/contractors/new"
              className="inline-block px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all"
            >
              Добавить первого
            </a>
          </div>
        ) : (
          <>
            {/* Mobile: карточки */}
            <div className="md:hidden space-y-3">
              {contractors.map((c) => (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-lg shrink-0">
                      🏢
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 break-words">
                        {c.name}
                      </div>
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone}`}
                          className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                        >
                          📞 {c.phone}
                        </a>
                      ) : (
                        <div className="text-sm text-slate-400 mt-1">📞 Телефон не указан</div>
                      )}
                    </div>
                  </div>

                  {c.notes && (
                    <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 break-words">
                      📝 {c.notes}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <a
                      href={`/contractors/${c.id}/edit`}
                      className="flex-1 text-center px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium
                                 hover:bg-slate-100 transition-all active:scale-[0.98]"
                    >
                      ✏️ Изменить
                    </a>
                    <form action={deleteContractor.bind(null, c.id)} className="flex-1">
                      <button
                        type="submit"
                        className="w-full px-4 py-2 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                   text-sm font-medium hover:bg-red-500 hover:text-white transition-all active:scale-[0.98]"
                      >
                        🗑️ Удалить
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: таблица */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Название</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Телефон</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Заметки</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {contractors.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{c.name}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="hover:text-blue-600">
                            {c.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500 max-w-[300px] truncate">
                        {c.notes || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={`/contractors/${c.id}/edit`}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium
                                       hover:bg-slate-100 transition-all"
                          >
                            ✏️
                          </a>
                          <form action={deleteContractor.bind(null, c.id)}>
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 border border-red-500/30
                                         text-xs font-medium hover:bg-red-500 hover:text-white transition-all"
                            >
                              🗑️
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </main>
  );
}
