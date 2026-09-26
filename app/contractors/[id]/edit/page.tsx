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
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:p-6 space-y-4';
  const sectionTitleClass = 'text-base md:text-lg font-bold text-slate-900 mb-2';

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[700px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a href="/contractors" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все подрядчики
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">✏️ Редактировать подрядчика</h1>
        </div>

        <form
          action={updateContractor.bind(null, id)}
          className="space-y-4 md:space-y-6"
        >

          {/* ОСНОВНОЕ */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🏢 Данные фирмы</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Короткое название *</label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={contractor.name || ''}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Полное юр. название</label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={contractor.full_name || ''}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Адрес</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={contractor.address || ''}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>NIP / Tax ID</label>
                <input
                  type="text"
                  name="tax_id"
                  defaultValue={contractor.tax_id || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* КОНТАКТЫ */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📞 Контакты</h2>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Контактное лицо</label>
                <input
                  type="text"
                  name="contact_person"
                  defaultValue={contractor.contact_person || ''}
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
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={contractor.email || ''}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* ЗАМЕТКИ */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>📝 Заметки</h2>
            <textarea
              name="notes"
              rows={3}
              defaultValue={contractor.notes || ''}
              className={inputClass}
            />
          </div>

          {/* КНОПКИ */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href="/contractors"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all"
            >
              Отмена
            </a>
            <button
              type="submit"
              className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all active:scale-[0.98]"
            >
              ✅ Сохранить
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}
