import Link from 'next/link';
import { redirect } from 'next/navigation';
import { can, deniedRedirect } from '../../../lib/roles';
import { getSessionContext } from '../../../lib/session';
import { createManager } from '../actions';
import SubmitButton from '../../components/SubmitButton';
import { ArrowLeft, UserPlus, Save } from 'lucide-react';
import { getT } from '../../../lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function NewManagerPage() {
  const { t } = await getT();
  const { role } = await getSessionContext();
  const denied = deniedRedirect(role, 'managers.edit');
  if (denied) redirect(denied);
  if (!can(role, 'managers.edit')) redirect('/');

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-5 md:space-y-6">

        <Link
          href="/managers"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          {t('mgr.backToList')}
        </Link>

        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
            <UserPlus className="w-6 h-6 md:w-7 md:h-7 text-brand-600" strokeWidth={2.2} />
            {t('mgr.newTitle')}
          </h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            {t('mgr.newHint')}
          </p>
        </div>

        <form action={createManager} className="card p-5 md:p-6 space-y-5">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">
              {t('mgr.fullName')}{' '}<span className="text-red-500">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              required
              className="input"
              placeholder={t('mgr.phName')}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                {t('drv.phone')}
              </label>
              <input id="phone" name="phone" className="input" placeholder="+375 29 000 00 00" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                E-mail
              </label>
              <input id="email" name="email" type="email" className="input" placeholder="manager@example.com" />
              <p className="text-xs text-slate-500 mt-1">
                {t('mgr.emailHint')}
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="telegram_chat_id" className="block text-sm font-medium text-slate-700 mb-1">
              Telegram chat ID
            </label>
            <input id="telegram_chat_id" name="telegram_chat_id" className="input" placeholder="123456789" />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              {t('seg.notes')}
            </label>
            <textarea id="notes" name="notes" rows={3} className="input" placeholder={t('mgr.phNotes')} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <Link
              href="/managers"
              className="btn btn-secondary w-full sm:w-auto text-center"
            >
              {t('seg.cancel')}
            </Link>
            <SubmitButton
              className="btn btn-primary w-full sm:w-auto text-center"
              pendingText={t('mgr.saving')}
            >
              <Save className="w-4 h-4" strokeWidth={2} />
              {t('common.save')}
            </SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}
