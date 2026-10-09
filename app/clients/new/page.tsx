import { createClient as createSupabaseClient } from '../../../lib/supabase-server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import SubmitButton from '../../components/SubmitButton';
import { logAudit } from '../../../lib/audit';
import { ArrowLeft, Users, Building2, Save } from 'lucide-react';

async function createClient(formData: FormData) {
  'use server';

  const supabase = await createSupabaseClient();

  const name = formData.get('name') as string;
  const contactPerson = formData.get('contact_person') as string;
  const phone = formData.get('phone') as string;
  const email = formData.get('email') as string;

  const { data: created, error } = await supabase
    .from('clients')
    .insert([
      {
        name: name,
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null
      }
    ])
    .select('id')
    .single();

  if (error) throw new Error(`Ошибка добавления: ${error.message}`);

  if (created?.id) {
    await logAudit({
      entity_type: 'client',
      entity_id: created.id,
      action: 'create',
      summary: `Создан клиент «${name}»`,
    });
  }

  revalidatePath('/clients');
  redirect('/clients');
}

export default function NewClientPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/clients"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все клиенты
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Users className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Добавить клиента
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Заполните данные о компании
          </p>
        </div>

        <form action={createClient} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Данные компании
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Название компании *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="ООО «ТрансЛогистик»"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Контактное лицо
                </label>
                <input
                  type="text"
                  name="contact_person"
                  placeholder="Иван Иванов"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Телефон
                </label>
                <input
                  type="text"
                  name="phone"
                  placeholder="+48 123 456 789"
                  className="input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="client@example.com"
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-3 sm:static
                          bg-slate-50/95 sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none
                          -mx-4 px-4 sm:mx-0 sm:px-0 py-3 sm:py-0
                          border-t sm:border-0 border-slate-200">
            <a
              href="/clients"
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              Отмена
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText="Сохраняю клиента…"
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Сохранить клиента
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
