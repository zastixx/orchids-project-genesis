'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LiveTracking, Bus, Driver, Route } from '@/types';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const busIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface BusMapModalProps {
  tracking: LiveTracking;
  bus: Bus | null;
  driver: Driver | null;
  route: Route | null;
  onClose: () => void;
}

export default function BusMapModal({ tracking, bus, driver, route, onClose }: BusMapModalProps) {
  const lat = tracking.location?.latitude || 27.0;
  const lng = tracking.location?.longitude || 84.5;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="font-semibold text-gray-800">
              {bus?.registration_number || 'Bus Location'}
            </h2>
            <p className="text-xs text-gray-500">
              {driver?.name} &bull; {route?.route_name}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close map">
            <X size={18} />
          </Button>
        </div>

        {/* Map */}
        <div className="relative z-0" style={{ height: 420 }}>
          <MapContainer
            center={[lat, lng]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker position={[lat, lng]} icon={busIcon}>
              <Popup>
                <div className="text-sm">
                  <strong>{bus?.registration_number}</strong><br />
                  Driver: {driver?.name}<br />
                  Speed: {Math.round(tracking.location?.speed_kmph || 0)} km/h<br />
                  Accuracy: {Math.round(tracking.location?.accuracy || 0)}m
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>

        {/* Info footer */}
        <div className="grid grid-cols-3 divide-x text-center py-2 border-t">
          <div className="py-1">
            <p className="text-xs text-gray-400">Speed</p>
            <p className="font-semibold text-sm">{Math.round(tracking.location?.speed_kmph || 0)} km/h</p>
          </div>
          <div className="py-1">
            <p className="text-xs text-gray-400">GPS Accuracy</p>
            <p className="font-semibold text-sm">{Math.round(tracking.location?.accuracy || 0)}m</p>
          </div>
          <div className="py-1">
            <p className="text-xs text-gray-400">Progress</p>
            <p className="font-semibold text-sm">{Math.round(tracking.segment_progress_percentage || 0)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
