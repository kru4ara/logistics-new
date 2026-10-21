'use client';

import dynamic from 'next/dynamic';

const TripsBulkList = dynamic(() => import('./TripsBulkList'), {
  ssr: false,
  loading: () => (
    <div className="card p-10 md:p-16 text-center animate-fade-in">
      <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
      <p className="text-slate-500 text-sm">Загружаю список рейсов…</p>
    </div>
  ),
});

export default TripsBulkList;
