import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const BR_CENTER: [number, number] = [-14.235, -51.925];
const DEFAULT_ZOOM_NO_POINT = 4;
const ZOOM_WITH_POINT = 16;

type PontoLocationMapProps = {
  latitude: number | null;
  longitude: number | null;
  /** Raio em metros para o círculo no mapa (só desenha se maior que zero). */
  radiusMeters: number | null;
  onPositionChange: (lat: number, lng: number) => void;
  /** Incrementar após geocodificação/GPS para garantir centralização no mapa. */
  viewRevision?: number;
  className?: string;
};

function MapRecenter({ lat, lng, viewRevision = 0 }: { lat: number; lng: number; viewRevision?: number }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.setView([lat, lng], ZOOM_WITH_POINT, { animate: true });
  }, [lat, lng, viewRevision, map]);
  return null;
}

function MapClickSetPoint({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function PontoLocationMap({
  latitude,
  longitude,
  radiusMeters,
  onPositionChange,
  viewRevision = 0,
  className = '',
}: PontoLocationMapProps) {
  const hasPoint = latitude != null && longitude != null && !Number.isNaN(latitude) && !Number.isNaN(longitude);

  const center = useMemo((): [number, number] => {
    if (hasPoint) return [latitude!, longitude!];
    return BR_CENTER;
  }, [hasPoint, latitude, longitude]);

  const zoom = hasPoint ? ZOOM_WITH_POINT : DEFAULT_ZOOM_NO_POINT;

  const circleRadius =
    radiusMeters != null && Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : null;

  return (
    <div
      className={`rounded-xl border border-coop-200 overflow-hidden bg-coop-50/40 ${className}`}
      style={{ minHeight: 280 }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-[280px] w-full z-0"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapClickSetPoint onPick={onPositionChange} />
        {hasPoint ? (
          <>
            <MapRecenter lat={latitude!} lng={longitude!} viewRevision={viewRevision} />
            <Marker
              position={[latitude!, longitude!]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const p = m.getLatLng();
                  onPositionChange(p.lat, p.lng);
                },
              }}
            />
            {circleRadius != null ? (
              <Circle
                center={[latitude!, longitude!]}
                radius={circleRadius}
                pathOptions={{
                  color: '#166534',
                  fillColor: '#22c55e',
                  fillOpacity: 0.15,
                  weight: 2,
                }}
              />
            ) : null}
          </>
        ) : null}
      </MapContainer>
      <p className="text-xs text-coop-600 px-3 py-2 border-t border-coop-200 bg-white/90">
        Mapa OpenStreetMap — pesquise um endereço acima para posicionar o mapa, ou clique no mapa / arraste o marcador.
        {circleRadius != null ? ` Círculo: raio de ${circleRadius} m.` : null}
      </p>
    </div>
  );
}
