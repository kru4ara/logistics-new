'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useT } from '../components/I18nProvider';

function MapLoading() {
  const { t } = useT();
  return (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
        {t('cmp.mapLoading')}
      </div>
    </div>
  );
}

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <MapLoading />,
});

export default MapView;
