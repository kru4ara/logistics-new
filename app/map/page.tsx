'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function MapPage() {
  const [trips, setTrips] = useState<any[]>([]);

  useEffect(() => {
    async function loadTrips() {
      const { data } = await supabase
        .from('trips')
        .select('id, route, revenue_eur, status, start_location');
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
          <MapContainer center={[52.2297, 21.0122]} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {trips?.map((trip) => (
              <Marker key={trip.id} position={[52.2297, 21.0122]}>
                <Popup>
                  <strong>Маршрут:</strong> {trip.route || '-'}<br />
                  <strong>Статус:</strong> {trip.status}<br />
                  <strong>Фрахт:</strong> {trip.revenue_eur ? `${trip.revenue_eur} €` : '-'}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </main>
  );
}
