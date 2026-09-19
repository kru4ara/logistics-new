import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';
import { updateContractor } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditContractorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const role = cookies().get('role')?.value;
  if (role === 'driver') redirect('/driver');

  const supabase = await createClient();

  const { data: contractor, error } = await supabase
    .from('contractors')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contractor) {
    return <div className="p-8 text-red-500">Подрядчик не найден</div>;
  }

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
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать подрядчика</h1>
        </div>

        <form
          action={updateContractor.bind(null, id)}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4"
        >
          <div>
            <label className={labelClass}>Название фирмы *</label>
            <input
              type="text"
              name="name"
              required
              defaultValue={contractor.name || ''}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Телефон</label>
            <input
              type="text"
              name="phone"
              defaultValue={contractor.phone || ''}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Заметки</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={contractor.notes || ''}
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить
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
