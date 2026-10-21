'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
        Загрузка карты…
      </div>
    </div>
  ),
});

export default MapView;
