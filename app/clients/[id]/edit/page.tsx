import { createClient } from '../../../../lib/supabase/admin';
import { updateClient } from '../../../client-actions';
import { ArrowLeft, Users, Building2, Save } from 'lucide-react';
import SubmitButton from '../../../components/SubmitButton';
import { getT } from '../../../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getT();
  const { id: clientId } = await params;

  const supabase = await createClient();

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error) return <div className="p-8 text-red-500">{t('dir.error')}{' '} {error.message}</div>;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <a
          href={`/clients/${clientId}`}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-600 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('cli.back')}
        </a>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <Users className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('cli.editTitle')}
          </h1>
        </div>

        <form action={updateClient.bind(null, clientId)} className="space-y-4 md:space-y-6">

          <div className="card p-5 md:p-6 space-y-4">
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-600" strokeWidth={2} />
              {t('cli.company')}
            </h2>
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('cli.companyName')}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={client.name || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('dir.contact')}
                </label>
                <input
                  type="text"
                  name="contact_person"
                  defaultValue={client.contact_person || ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('drv.phone')}
                </label>
                <input
                  type="text"
                  name="phone"
                  defaultValue={client.phone || ''}
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
                  defaultValue={client.email || ''}
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
              href={`/clients/${clientId}`}
              className="w-full sm:w-auto text-center px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold
                         hover:bg-slate-100 transition-all duration-150"
            >
              {t('seg.cancel')}
            </a>
            <SubmitButton
              className="btn btn-primary w-full sm:flex-1 py-3"
              pendingText={t('tripForm.savingChanges')}
            >
              <Save className="w-4 h-4" strokeWidth={2.5} />
              {t('tripForm.saveChanges')}
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
