'use client';

import { FlaskConical } from 'lucide-react';
import { useT } from './I18nProvider';

/** Полоса «это демо» — только в демо-проекте (DEMO_MODE=1, app/layout.tsx). */
export default function DemoBanner() {
  const { t } = useT();
  return (
    <div className="sticky top-0 z-[90] bg-amber-400 text-amber-950 text-xs md:text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-2 text-center">
      <FlaskConical className="w-4 h-4 shrink-0" strokeWidth={2.2} />
      {t('demo.banner')}
    </div>
  );
}
