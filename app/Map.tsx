'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map({ trips }: { trips: any[] }) {
  return (
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
            <strong>Выручка:</strong> {trip.revenue_eur ? `${trip.revenue_eur} €` : '-'}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
