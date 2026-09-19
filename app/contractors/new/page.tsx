import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createContractor } from '../actions';

export const dynamic = 'force-dynamic';

export default function NewContractorPage() {
  const cookieStore = cookies();
  const role = cookieStore.get('role')?.value;
  if (role !== 'office') redirect('/login');

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[700px] mx-auto px-6 py-8 space-y-6">

        <a href="/contractors" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все подрядчики
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Новый подрядчик</h1>
          <p className="text-slate-500 mt-1">Фирма, которой мы передаём груз для перевозки</p>
        </div>

        <form action={createContractor} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <label className={labelClass}>Название фирмы *</label>
            <input
              type="text"
              name="name"
              required
              placeholder="ООО Ромашка"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Телефон</label>
            <input
              type="text"
              name="phone"
              placeholder="+48 123 456 789"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Дополнительная информация"
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Создать
            </button>
            <a
              href="/contractors"
              className="px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
          </div>
        </form>

      </div>
    </main>
  );
}
