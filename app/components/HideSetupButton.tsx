'use client';

import { useTransition } from 'react';
import { X, Loader2 } from 'lucide-react';
import { hideSetupChecklist } from '../setup-actions';
import { useT } from './I18nProvider';

export default function HideSetupButton() {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => hideSetupChecklist())}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 shrink-0"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      {t('setup.hide')}
    </button>
  );
}
