'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapView({ trips }: { trips: any[] }) {
  const points = trips.filter((t) => t.start_lat && t.start_lng);

  return (
    <MapContainer
      center={[52.2297, 21.0122]}
      zoom={6}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((trip) => (
        <Marker key={trip.id} position={[trip.start_lat, trip.start_lng]}>
          <Popup>
            <strong>№ {trip.trip_number || '—'}</strong>
            <br />
            <strong>Маршрут:</strong> {trip.route || '—'}
            <br />
            <strong>Статус:</strong> {trip.status}
            <br />
            <a href={`/trips/${trip.id}`} style={{ color: '#0070f3' }}>
              Открыть рейс →
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
