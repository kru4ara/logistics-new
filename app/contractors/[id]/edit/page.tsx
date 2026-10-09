import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '../../../../lib/supabase-server';
import { updateContractor } from '../../actions';
import { EUROPEAN_COUNTRIES } from '../../../../lib/countries';
import SubmitButton from '../../../components/SubmitButton';
import {
  ArrowLeft,
  Pencil,
  Building2,
  Phone,
  FileText,
  Save,
} from 'lucide-react';

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

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[700px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href="/contractors"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Все подрядчики
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Pencil className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            Редактировать подрядчика
          </h1>
        </div>

        <form action={updateContractor.bind(null, id)} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Данные фирмы
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Короткое название *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={contractor.name || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Полное юр. название
                </label>
                <input
                  type="text"
                  name="full_name"
                  defaultValue={contractor.full_name || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Страна</label>
                <select
                  name="country"
                  className="input"
                  defaultValue={contractor.country || ''}
                >
                  <option value="">— Выберите страну —</option>
                  {EUROPEAN_COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Адрес</label>
                <input
                  type="text"
                  name="address"
                  defaultValue={contractor.address || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">NIP / Tax ID</label>
                <input
                  type="text"
                  name="tax_id"
                  defaultValue={contractor.tax_id || ''}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Phone className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Контакты
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Контактное лицо
                </label>
                <input
                  type="text"
                  name="contact_person"
                  defaultValue={contractor.contact_person || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Телефон</label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={contractor.phone || ''}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={contractor.email || ''}
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" strokeWidth={2} />
              Заметки
            </h2>
            <textarea
              name="notes"
              rows={3}
              defaultValue={contractor.notes || ''}
              className="input"
            />
          </div>

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
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText="Сохраняю…"
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              Сохранить
            </SubmitButton>
          </div>

        </form>
      </div>
    </main>
  );
}
