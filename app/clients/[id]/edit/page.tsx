import { createClient } from '../../../../lib/supabase-server';
import { updateClient } from '../../../client-actions';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error) return <div className="p-8 text-red-500">Ошибка: {error.message}</div>;

  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">
        <a href={`/clients/${clientId}`} className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Назад к клиенту
        </a>

        <div>
          <h1 className="text-3xl font-bold text-slate-900">✏️ Редактировать клиента</h1>
        </div>

        <form action={updateClient.bind(null, clientId)} className="space-y-6">
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🏢 Данные компании</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Название компании *</label>
                <input type="text" name="name" required defaultValue={client.name || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Контактное лицо</label>
                <input type="text" name="contact_person" defaultValue={client.contact_person || ''} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Телефон</label>
                <input type="text" name="phone" defaultValue={client.phone || ''} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Email</label>
                <input type="email" name="email" defaultValue={client.email || ''} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить изменения
            </button>
            <a
              href={`/clients/${clientId}`}
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
