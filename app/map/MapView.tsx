'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ============================================================
// Кастомные иконки — цветной кружок с номером рейса
// ============================================================
function makeIcon(label: string, color: string): L.DivIcon {
  const safeLabel = label.replace(/</g, '').replace(/>/g, '').slice(0, 5);
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: ${color};
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 11px;
        border: 2.5px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        font-family: system-ui, -apple-system, sans-serif;
      ">${safeLabel}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

// ============================================================
// Иконка кластера — большой кружок с количеством маркеров
// ============================================================
function createClusterCustomIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 40 : count < 100 ? 50 : 60;
  const fontSize = count < 10 ? 14 : count < 100 ? 16 : 18;

  return L.divIcon({
    html: `
      <div style="
        background: linear-gradient(135deg, #3b82f6, #1e40af);
        color: white;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: ${fontSize}px;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
        font-family: system-ui, -apple-system, sans-serif;
      ">${count}</div>
    `,
    className: 'custom-cluster-icon',
    iconSize: L.point(size, size, true),
  });
}

const statusLabels: Record<string, string> = {
  planned: 'Планируется',
  active: 'В пути',
  completed: 'Завершён',
  invoiced: 'Выставлен счёт',
  paid: 'Оплачен',
};

const statusColors: Record<string, string> = {
  planned: '#94a3b8',
  active: '#3b82f6',
  completed: '#22c55e',
  invoiced: '#eab308',
  paid: '#10b981',
};

type Trip = {
  id: string;
  trip_number: number | null;
  route: string | null;
  status: string;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  start_date: string | null;
  sender_city: string | null;
  sender_country: string | null;
  receiver_city: string | null;
  receiver_country: string | null;
};

export default function MapView({ trips }: { trips: Trip[] }) {
  const withBoth = trips.filter(
    (t) => t.start_lat && t.start_lng && t.end_lat && t.end_lng
  );

  const onlyStart = trips.filter(
    (t) => t.start_lat && t.start_lng && (!t.end_lat || !t.end_lng)
  );

  return (
    <MapContainer
      center={[52.2297, 21.0122]}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Линии маршрутов (не кластеризуются — всегда видны) */}
      {withBoth.map((trip) => (
        <Polyline
          key={`line-${trip.id}`}
          positions={[
            [trip.start_lat!, trip.start_lng!],
            [trip.end_lat!, trip.end_lng!],
          ]}
          pathOptions={{
            color: statusColors[trip.status] || '#94a3b8',
            weight: 2,
            opacity: 0.4,
            dashArray: '6, 8',
          }}
        />
      ))}

      {/* 🟢 Кластер маркеров загрузки */}
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterCustomIcon}
        maxClusterRadius={50}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
      >
        {[...withBoth, ...onlyStart].map((trip) => {
          const label = trip.trip_number ? `№${trip.trip_number}` : '•';
          return (
            <Marker
              key={`start-${trip.id}`}
              position={[trip.start_lat!, trip.start_lng!]}
              icon={makeIcon(label, '#16a34a')}
            >
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                    🟢 Загрузка · №{trip.trip_number || '—'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    {trip.sender_city}, {trip.sender_country}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    <b>Маршрут:</b> {trip.route || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                    📅 {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                    {' · '}
                    <span style={{ color: statusColors[trip.status] || '#64748b', fontWeight: 600 }}>
                      {statusLabels[trip.status] || trip.status}
                    </span>
                  </div>
                  <a
                    href={`/trips/${trip.id}`}
                    style={{ color: '#2563eb', fontWeight: 600, fontSize: '12px' }}
                  >
                    Открыть рейс →
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>

      {/* 🔴 Кластер маркеров выгрузки */}
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterCustomIcon}
        maxClusterRadius={50}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
      >
        {withBoth.map((trip) => {
          const label = trip.trip_number ? `№${trip.trip_number}` : '•';
          return (
            <Marker
              key={`end-${trip.id}`}
              position={[trip.end_lat!, trip.end_lng!]}
              icon={makeIcon(label, '#dc2626')}
            >
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: '200px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                    🔴 Выгрузка · №{trip.trip_number || '—'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    {trip.receiver_city}, {trip.receiver_country}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    <b>Маршрут:</b> {trip.route || '—'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                    📅 {trip.start_date ? new Date(trip.start_date).toLocaleDateString('ru-RU') : '—'}
                    {' · '}
                    <span style={{ color: statusColors[trip.status] || '#64748b', fontWeight: 600 }}>
                      {statusLabels[trip.status] || trip.status}
                    </span>
                  </div>
                  <a
                    href={`/trips/${trip.id}`}
                    style={{ color: '#2563eb', fontWeight: 600, fontSize: '12px' }}
                  >
                    Открыть рейс →
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
