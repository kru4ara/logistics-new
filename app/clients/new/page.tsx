import { supabase } from '../../../lib/supabaseClient';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

async function createClient(formData: FormData) {
  'use server';

  const name = formData.get('name') as string;
  const contactPerson = formData.get('contact_person') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;

  const { error } = await supabase
    .from('clients')
    .insert([
      {
        name: name,
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null
      }
    ]);

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);
  revalidatePath('/clients');
  redirect('/clients');
}

export default function NewClientPage() {
  const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-150";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const sectionClass = "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4";
  const sectionTitleClass = "text-lg font-bold text-slate-900 mb-2 flex items-center gap-2";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        {/* Назад */}
        <a href="/clients" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium">
          ← Все клиенты
        </a>

        {/* Заголовок */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">➕ Добавить клиента</h1>
          <p className="text-slate-500 mt-1">Заполните данные о компании</p>
        </div>

        <form action={createClient} className="space-y-6">

          {/* Основные данные */}
          <div className={sectionClass}>
            <h2 className={sectionTitleClass}>🏢 Данные компании</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Название компании *</label>
                <input type="text" name="name" required placeholder="ООО «ТрансЛогистик»" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Контактное лицо</label>
                <input type="text" name="contact_person" placeholder="Иван Иванов" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Телефон</label>
                <input type="text" name="phone" placeholder="+48 123 456 789" className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Email</label>
                <input type="email" name="email" placeholder="client@example.com" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl
                         shadow-md shadow-blue-600/20 transition-all duration-150 active:scale-[0.98]"
            >
              ✅ Сохранить клиента
            </button>
            <a
              href="/clients"
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
