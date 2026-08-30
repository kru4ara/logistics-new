'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Настройка иконок Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView({ trips }: { trips: any[] }) {
  return (
    <MapContainer center={[52.2297, 21.0122]} zoom={6} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {trips?.map((trip) => (
        <Marker key={trip.id} position={[trip.start_lat || 52.2297, trip.start_lng || 21.0122]}>
          <Popup>
            <strong>Маршрут:</strong> {trip.route || '-'}<br />
            <strong>Статус:</strong> {trip.status}<br />
            <strong>Фрахт:</strong> {trip.revenue_eur ? `${trip.revenue_eur} €` : '-'}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
