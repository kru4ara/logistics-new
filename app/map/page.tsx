'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Динамически импортируем карту, чтобы она работала только в браузере
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Загрузка карты...</div>
});

export default function MapPage() {
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    async function loadTrips() {
      const { data } = await supabase
        .from('trips')
        .select('id, route, revenue_eur, status, start_lat, start_lng');
      setTrips(data || []);
    }
    loadTrips();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">🚛 Карта рейсов</h1>
          <a href="/" className="text-blue-600 underline">← Панель управления</a>
        </div>

        <div style={{ height: '600px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <MapView trips={trips} />
        </div>
      </div>
    </main>
  );
}
