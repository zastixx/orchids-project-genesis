'use client';
import { useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray, createItem, updateItem, deleteItem } from '@/lib/firebaseHelpers';
import { Stop, Route } from '@/types';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, MapPin, Filter, Route as RouteIcon, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

// ... (rest of the file)

// Fix leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const stopIcons = {
  terminal: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  }),
  junction: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  }),
  conditional: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-grey.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  }),
  district: new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-gold.png',
    iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  }),
};

const BIHAR_DISTRICTS = [
  'Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Purnia', 'Araria',
  'Aurangabad', 'Banka', 'Begusarai', 'Bhabua', 'Bhojpur', 'Buxar', 'East Champaran',
  'West Champaran', 'Gopalganj', 'Jamui', 'Jehanabad', 'Kaimur', 'Katihar', 'Khagaria',
  'Kishanganj', 'Lakhisarai', 'Madhepura', 'Madhubani', 'Munger', 'Nalanda', 'Nawada',
  'Rohtas', 'Saharsa', 'Samastipur', 'Saran', 'Sheikhpura', 'Sheohar', 'Sitamarhi',
  'Siwan', 'Supaul', 'Vaishali'
];

interface GeneratedStop extends Omit<Stop, 'id'> {
  selected: boolean;
  instruction?: string;
}

const emptyStop = (): Omit<Stop, 'id'> => ({
  name: '', local_name: '', latitude: 26.8, longitude: 84.9,
  type: 'junction', district: 'Patna', geofence_radius: 300,
});

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export default function StopsPageContent() {
  const { data: stopsRaw, loading } = useRealtimeData<Record<string, Stop>>('/stops');
  const { data: routesRaw } = useRealtimeData<Record<string, Route>>('/routes');

  const stops = objectToArray<Stop>(stopsRaw);
  const routes = objectToArray<Route>(routesRaw);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editStop, setEditStop] = useState<(Omit<Stop, 'id'> & { id?: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [suggestedAddress, setSuggestedAddress] = useState<string | null>(null);

  // --- Valhalla Route Generation States ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [routeStart, setRouteStart] = useState<[number, number] | null>(null);
  const [routeEnd, setRouteEnd] = useState<[number, number] | null>(null);
  const [isPickingStart, setIsPickingStart] = useState(false);
  const [isPickingEnd, setIsPickingEnd] = useState(false);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [generatedStops, setGeneratedStops] = useState<GeneratedStop[]>([]);
  const [routeShape, setRouteShape] = useState<[number, number][]>([]);
  
  // Search states for manual entry
  const [startSearch, setStartSearch] = useState('');
  const [endSearch, setEndSearch] = useState('');
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);

  // Bihar boundary check (simplified bounding box)
  // Approx: Lat 24-28, Lng 83-88
  const isPointInBihar = (lat: number, lng: number) => {
    return lat >= 23.5 && lat <= 28.5 && lng >= 82.5 && lng <= 89.0;
  };

  // Clear suggestions when dialog closes
  useEffect(() => {
    if (!editStop) {
      setSuggestedAddress(null);
      setIsFetchingAddress(false);
    }
  }, [editStop]);

  const filtered = stops.filter((s) => {
    const searchLower = (search || '').toLowerCase();
    const nameMatch = (s.name || '').toLowerCase().includes(searchLower);
    const localMatch = (s.local_name || '').toLowerCase().includes(searchLower);
    const distMatch = (s.district || '').toLowerCase().includes(searchLower);
    const matchSearch = nameMatch || localMatch || distMatch;
    const matchType = filterType === 'all' || s.type === filterType;
    return matchSearch && matchType;
  });

  const handleAddressSearch = async (query: string, setCoords: (c: [number, number]) => void, setIsSearching: (s: boolean) => void) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      // Limit search to Bihar for better results if not specified
      const searchQuery = query.toLowerCase().includes('bihar') ? query : `${query}, Bihar, India`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setCoords([lat, lon]);
        toast.success(`Found location: ${data[0].display_name.split(',')[0]}`);
      } else {
        toast.error('Location not found');
      }
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Failed to search address');
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (isPickingStart) {
      setRouteStart([lat, lng]);
      setIsPickingStart(false);
      return;
    }
    if (isPickingEnd) {
      setRouteEnd([lat, lng]);
      setIsPickingEnd(false);
      return;
    }

    if (editStop) {
      setEditStop((prev) => prev ? { ...prev, latitude: lat, longitude: lng } : null);
      
      setIsFetchingAddress(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data && data.display_name) {
          // Extract a good name: prioritized order
          const addr = data.address || {};
          const suggestion = addr.amenity || addr.bus_stop || addr.railway || addr.building || addr.road || addr.suburb || data.display_name.split(',')[0];
          setSuggestedAddress(suggestion);
        }
      } catch (err) {
        console.error('Failed to fetch address:', err);
      } finally {
        setIsFetchingAddress(false);
      }
    }
  }, [editStop, isPickingStart, isPickingEnd]);

  // --- Valhalla Logic ---
  const decodePolyline = (str: string, precision: number = 6) => {
    let index = 0, lat = 0, lng = 0, coordinates = [];
    const factor = Math.pow(10, precision);
    while (index < str.length) {
      let byte, shift = 0, result = 0;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0; result = 0;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      coordinates.push([lat / factor, lng / factor] as [number, number]);
    }
    return coordinates;
  };

  const fetchRouteAndStops = async () => {
    if (!routeStart || !routeEnd) {
      toast.error('Please set start and end points');
      return;
    }
    setIsFetchingRoute(true);
    setGeneratedStops([]);
    setRouteShape([]);
    try {
      const body = {
        locations: [
          { lat: routeStart[0], lon: routeStart[1] },
          { lat: routeEnd[0], lon: routeEnd[1] }
        ],
        costing: 'auto',
        directions_options: { units: 'km' }
      };
      
      const res = await fetch('https://valhalla1.openstreetmap.de/route', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      const data = await res.json();
      
      if (!data.trip || !data.trip.legs) {
        toast.error('Could not find route');
        return;
      }

      const leg = data.trip.legs[0];
      const shape = decodePolyline(leg.shape);
      setRouteShape(shape);

      // --- Overpass Integration for better stops ---
      // Sample polyline points to query Overpass (every ~5km)
      const sampledPoints = [];
      const step = Math.max(1, Math.floor(shape.length / 15));
      for (let i = 0; i < shape.length; i += step) {
        sampledPoints.push(shape[i]);
      }
      if (sampledPoints[sampledPoints.length - 1] !== shape[shape.length - 1]) {
        sampledPoints.push(shape[shape.length - 1]);
      }

      // Build Overpass query for cities, towns, and junctions near the route
      // We search within 1000m of the sampled points
      const aroundQueries = sampledPoints.map(p => `node(around:1000,${p[0]},${p[1]})[place~"city|town|village|hamlet"];`).join('');
      const junctionQueries = sampledPoints.map(p => `node(around:300,${p[0]},${p[1]})[highway~"motorway_junction|junction"];`).join('');
      
      const overpassQuery = `[out:json][timeout:25];(
        ${aroundQueries}
        ${junctionQueries}
      );out;`;

      const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`
      });
      const overpassData = await overpassRes.json();
      
      const extracted: GeneratedStop[] = [];
      const seenNames = new Set<string>();

      // Also include start and end points
      const startName = await fetchReverseGeocode(routeStart[0], routeStart[1]) || 'Start Point';
      const endName = await fetchReverseGeocode(routeEnd[0], routeEnd[1]) || 'End Point';

      // Function to find the index on shape closest to a point
      const findClosestIndex = (lat: number, lon: number) => {
        let minD = Infinity, minI = 0;
        for (let i = 0; i < shape.length; i++) {
          const d = Math.pow(shape[i][0] - lat, 2) + Math.pow(shape[i][1] - lon, 2);
          if (d < minD) { minD = d; minI = i; }
        }
        return minI;
      };

      if (overpassData.elements) {
        for (const el of overpassData.elements) {
          const name = el.tags.name || el.tags['name:en'] || el.tags.place || 'Unnamed Location';
          const type = el.tags.place === 'city' ? 'district' : 
                       (el.tags.highway === 'motorway_junction' || el.tags.junction) ? 'junction' : 
                       el.tags.place === 'town' ? 'junction' : 'conditional';
          
          if (!seenNames.has(name) && name.length > 2) {
            seenNames.add(name);
            extracted.push({
              name,
              local_name: el.tags['name:hi'] || name,
              latitude: el.lat,
              longitude: el.lon,
              type: type as any,
              district: el.tags['is_in:county'] || el.tags['addr:district'] || 'Patna',
              geofence_radius: type === 'district' ? 1000 : 300,
              selected: true,
              instruction: el.tags.description || `Near ${name}`,
              shapeIndex: findClosestIndex(el.lat, el.lon)
            } as any);
          }
        }
      }

      // Add Start/End if not present
      if (!seenNames.has(startName)) {
        extracted.push({
          name: startName, local_name: startName, latitude: routeStart[0], longitude: routeStart[1],
          type: 'terminal', district: 'Patna', geofence_radius: 500, selected: true, instruction: 'Starting Point', shapeIndex: 0
        } as any);
      }
      if (!seenNames.has(endName)) {
        extracted.push({
          name: endName, local_name: endName, latitude: routeEnd[0], longitude: routeEnd[1],
          type: 'terminal', district: 'Patna', geofence_radius: 500, selected: true, instruction: 'Ending Point', shapeIndex: shape.length - 1
        } as any);
      }

      // Sort by shape index to ensure sequential order
      extracted.sort((a: any, b: any) => a.shapeIndex - b.shapeIndex);

      setGeneratedStops(extracted);
      toast.success(`Found ${extracted.length} locations along route`);
    } catch (err) {
      console.error('Extraction error:', err);
      toast.error('Failed to fetch route or stops');
    } finally {
      setIsFetchingRoute(false);
    }
  };

  const fetchReverseGeocode = async (lat: number, lon: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
      const data = await res.json();
      return data.address.city || data.address.town || data.address.village || data.address.suburb || data.display_name.split(',')[0];
    } catch { return null; }
  };

  const handleImportStops = async () => {
    const toImport = generatedStops.filter(s => s.selected);
    if (toImport.length === 0) { toast.error('No stops selected'); return; }
    
    setSaving(true);
    try {
      let count = 0;
      for (const s of toImport) {
        const { selected, instruction, ...data } = s as any;
        await createItem('/stops', data);
        count++;
      }
      toast.success(`Imported ${count} stops`);
      setIsGenerating(false);
      setGeneratedStops([]);
      setRouteShape([]);
      setRouteStart(null);
      setRouteEnd(null);
    } catch {
      toast.error('Failed to import some stops');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = () => {
    setSuggestedAddress(null);
    setEditStop(emptyStop());
  };

  const handleOpenEdit = (stop: Stop) => {
    setSuggestedAddress(null);
    setEditStop({ ...stop });
  };

  const handleSave = async () => {
    if (!editStop) return;
    if (!editStop.name.trim()) { toast.error('Stop name is required'); return; }
    if (!editStop.local_name.trim()) { toast.error('Local name is required'); return; }
    if (editStop.latitude < -90 || editStop.latitude > 90) { toast.error('Invalid latitude'); return; }
    if (editStop.longitude < -180 || editStop.longitude > 180) { toast.error('Invalid longitude'); return; }
    setSaving(true);
    try {
      const data = { ...editStop };
      delete (data as { id?: string }).id;
      if (editStop.id) {
        await updateItem(`/stops/${editStop.id}`, data as Record<string, unknown>);
        toast.success('Stop updated');
      } else {
        await createItem('/stops', data as Record<string, unknown>);
        toast.success('Stop created');
      }
      setEditStop(null);
    } catch {
      toast.error('Failed to save stop');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const usedIn = routes.filter((r) =>
      (r.certain_stops_up || []).includes(deleteId) ||
      (r.certain_stops_down || []).includes(deleteId)
    );
    if (usedIn.length > 0) {
      toast.error(`Cannot delete - used in routes: ${usedIn.map((r) => r.route_name).join(', ')}`);
      setDeleteId(null);
      return;
    }
    try {
      await deleteItem(`/stops/${deleteId}`);
      toast.success('Stop deleted');
    } catch {
      toast.error('Failed to delete stop');
    } finally {
      setDeleteId(null);
    }
  };

  const typeColors: Record<string, string> = {
    terminal: 'bg-red-100 text-red-700 border-red-200',
    junction: 'bg-blue-100 text-blue-700 border-blue-200',
    conditional: 'bg-gray-100 text-gray-600 border-gray-200',
    district: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  const mapCenter: [number, number] = stops.length > 0
    ? [stops[0].latitude || 26.8, stops[0].longitude || 84.9]
    : [26.8, 84.9];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search stops..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
            <div className="flex gap-1.5">
              {['all', 'terminal', 'junction', 'conditional', 'district'].map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={filterType === t ? 'default' : 'outline'}
                  className={cn('h-7 text-xs capitalize', filterType === t ? 'bg-[#1976d2]' : '')}
                  onClick={() => setFilterType(t)}
                >
                  <Filter size={11} className="mr-1" />{t}
                </Button>
              ))}
            </div>

            <Button
              onClick={() => setIsGenerating(true)}
              size="sm"
              variant="outline"
              className="border-[#1976d2] text-[#1976d2] hover:bg-blue-50"
            >
              <RouteIcon size={15} className="mr-1" /> Generate from Route
            </Button>
            <Button onClick={handleOpenAdd} size="sm" className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
              <Plus size={15} className="mr-1" /> Add Stop
            </Button>

        </div>


        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Left: Stops list */}
          <div className="lg:col-span-2 bg-white rounded-lg border overflow-hidden">
            <div className="px-3 py-2 border-b bg-gray-50">
              <p className="text-xs text-gray-500 font-medium">{filtered.length} stops</p>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              {loading ? (
                <div className="p-3 space-y-2">{[1,2,3,4].map(i => (
                  <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                ))}</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <MapPin size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No stops found</p>
                </div>
              ) : filtered.map((stop) => (
                <div key={stop.id} className="px-3 py-2.5 border-b last:border-0 hover:bg-gray-50 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-sm truncate">{stop.name}</span>
                      <Badge className={cn('text-xs', typeColors[stop.type] || '')} variant="outline">
                        {stop.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">{stop.local_name}</p>
                    <p className="text-xs text-gray-400">{stop.district} · {stop.latitude?.toFixed(4)}, {stop.longitude?.toFixed(4)}</p>
                  </div>
                <div className="flex gap-0.5 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenEdit(stop)} aria-label="Edit stop">
                    <Pencil size={11} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => setDeleteId(stop.id)} aria-label="Delete stop">
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Map */}
        <div className="lg:col-span-3 rounded-lg overflow-hidden border relative z-0" style={{ height: 540 }}>
          <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapClickHandler onMapClick={handleMapClick} />
            
            {/* Route Generation Visuals */}
            {routeShape.length > 0 && (
              <Polyline positions={routeShape} color="#1976d2" weight={4} opacity={0.6} dashArray="8, 8" />
            )}
            {routeStart && (
              <Marker position={routeStart} icon={new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41]
              })}>
                <Popup>Route Start</Popup>
              </Marker>
            )}
            {routeEnd && (
              <Marker position={routeEnd} icon={new L.Icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
                iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41], iconAnchor: [12, 41]
              })}>
                <Popup>Route End</Popup>
              </Marker>
            )}

            {filtered.map((stop) => (
              <Marker
                key={stop.id}
                position={[stop.latitude, stop.longitude]}
                icon={stopIcons[stop.type] || stopIcons.junction}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{stop.name}</strong><br />
                    {stop.local_name}<br />
                    <span className="capitalize">{stop.type}</span> · {stop.district}
                  </div>
                </Popup>
                <Circle
                  center={[stop.latitude, stop.longitude]}
                  radius={stop.geofence_radius || 300}
                  pathOptions={{ color: stop.type === 'terminal' ? '#f44336' : '#1976d2', fillOpacity: 0.08, weight: 1 }}
                />
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={!!editStop} onOpenChange={(o) => !o && setEditStop(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editStop?.id ? 'Edit Stop' : 'Add New Stop'}</DialogTitle>
          </DialogHeader>
            {editStop && (
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Stop Name (English) *</Label>
                    {isFetchingAddress && <span className="text-[10px] text-blue-500 animate-pulse">Fetching address...</span>}
                  </div>
                  <Input value={editStop.name} onChange={(e) => setEditStop({ ...editStop, name: e.target.value })} placeholder="e.g. Raxaul Bus Terminal" />
                  {suggestedAddress && (
                    <button 
                      type="button"
                      onClick={() => setEditStop({ ...editStop, name: suggestedAddress })}
                      className="text-[10px] text-[#1976d2] hover:underline block text-left mt-0.5"
                    >
                      Suggestion: {suggestedAddress} (Click to use)
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Local Name (Hindi) *</Label>
                  <Input value={editStop.local_name} onChange={(e) => setEditStop({ ...editStop, local_name: e.target.value })} placeholder="e.g. रक्सौल बस टर्मिनल" />
                </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                    <Select value={editStop.type} onValueChange={(v) => setEditStop({ ...editStop, type: v as Stop['type'] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="terminal">Terminal</SelectItem>
                        <SelectItem value="junction">Junction</SelectItem>
                        <SelectItem value="conditional">Conditional</SelectItem>
                        <SelectItem value="district">District</SelectItem>
                      </SelectContent>
                    </Select>

                </div>
                <div className="space-y-1">
                  <Label>District</Label>
                  <Select value={editStop.district} onValueChange={(v) => setEditStop({ ...editStop, district: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-48">
                      {BIHAR_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Latitude *</Label>
                  <Input type="number" step="0.0001" value={editStop.latitude} onChange={(e) => setEditStop({ ...editStop, latitude: +e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Longitude *</Label>
                  <Input type="number" step="0.0001" value={editStop.longitude} onChange={(e) => setEditStop({ ...editStop, longitude: +e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Geofence Radius (meters)</Label>
                <Input type="number" value={editStop.geofence_radius || 300} onChange={(e) => setEditStop({ ...editStop, geofence_radius: +e.target.value })} />
              </div>
              <p className="text-xs text-gray-400">Click on the map to set coordinates automatically</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStop(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
              {saving ? 'Saving...' : 'Save Stop'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stop?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this stop. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Route Generation Dialog */}
      <Dialog 
        open={isGenerating} 
        modal={!(isPickingStart || isPickingEnd)}
        onOpenChange={(o) => {
          if (!o) {
            setIsGenerating(false);
            setIsPickingStart(false);
            setIsPickingEnd(false);
            setRouteShape([]);
            setGeneratedStops([]);
            setStartSearch('');
            setEndSearch('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Auto-generate Stops from Route</DialogTitle>
            <DialogDescription>
              Select start and end points manually or by clicking on the map. We'll find towns and junctions along the route.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Start Point */}
            <div className="space-y-4 border p-3 rounded-lg bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Start</Badge>
                <Label className="font-semibold text-xs uppercase tracking-wider">Starting Point</Label>
              </div>
              
              <div className="space-y-3">
                <div className="relative">
                  <Input 
                    placeholder="Search address (e.g. Patna)..." 
                    className="h-8 text-xs pr-8"
                    value={startSearch}
                    onChange={(e) => setStartSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch(startSearch, setRouteStart, setIsSearchingStart)}
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={() => handleAddressSearch(startSearch, setRouteStart, setIsSearchingStart)}
                    disabled={isSearchingStart}
                  >
                    {isSearchingStart ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-gray-500 ml-1">Latitude</Label>
                    <Input 
                      type="number" 
                      placeholder="Lat" 
                      className="h-8 text-xs" 
                      value={routeStart ? routeStart[0] : ''} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setRouteStart([val, routeStart ? routeStart[1] : 0]);
                        setIsPickingStart(false);
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-gray-500 ml-1">Longitude</Label>
                    <Input 
                      type="number" 
                      placeholder="Lng" 
                      className="h-8 text-xs" 
                      value={routeStart ? routeStart[1] : ''} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setRouteStart([routeStart ? routeStart[0] : 0, val]);
                        setIsPickingStart(false);
                      }}
                    />
                  </div>
                </div>

                <Button 
                  variant={isPickingStart ? "default" : "outline"} 
                  size="sm" 
                  className={cn("w-full h-8 text-xs", isPickingStart && "bg-blue-600")}
                  onClick={() => { setIsPickingStart(true); setIsPickingEnd(false); }}
                >
                  <MapPin size={12} className="mr-1.5" /> 
                  {isPickingStart ? "Click Map Now" : "Pick on Map"}
                </Button>
              </div>
            </div>

            {/* End Point */}
            <div className="space-y-4 border p-3 rounded-lg bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">End</Badge>
                <Label className="font-semibold text-xs uppercase tracking-wider">Ending Point</Label>
              </div>
              
              <div className="space-y-3">
                <div className="relative">
                  <Input 
                    placeholder="Search address (e.g. Raxaul)..." 
                    className="h-8 text-xs pr-8"
                    value={endSearch}
                    onChange={(e) => setEndSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch(endSearch, setRouteEnd, setIsSearchingEnd)}
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={() => handleAddressSearch(endSearch, setRouteEnd, setIsSearchingEnd)}
                    disabled={isSearchingEnd}
                  >
                    {isSearchingEnd ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-gray-500 ml-1">Latitude</Label>
                    <Input 
                      type="number" 
                      placeholder="Lat" 
                      className="h-8 text-xs" 
                      value={routeEnd ? routeEnd[0] : ''} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setRouteEnd([val, routeEnd ? routeEnd[1] : 0]);
                        setIsPickingEnd(false);
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-gray-500 ml-1">Longitude</Label>
                    <Input 
                      type="number" 
                      placeholder="Lng" 
                      className="h-8 text-xs" 
                      value={routeEnd ? routeEnd[1] : ''} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setRouteEnd([routeEnd ? routeEnd[0] : 0, val]);
                        setIsPickingEnd(false);
                      }}
                    />
                  </div>
                </div>

                <Button 
                  variant={isPickingEnd ? "default" : "outline"} 
                  size="sm" 
                  className={cn("w-full h-8 text-xs", isPickingEnd && "bg-blue-600")}
                  onClick={() => { setIsPickingEnd(true); setIsPickingStart(false); }}
                >
                  <MapPin size={12} className="mr-1.5" />
                  {isPickingEnd ? "Click Map Now" : "Pick on Map"}
                </Button>
              </div>
            </div>
          </div>

          {(isPickingStart || isPickingEnd) && (
            <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-md text-xs flex items-center mb-4 animate-in fade-in slide-in-from-top-1">
              <Loader2 size={12} className="mr-2 animate-spin" />
              <span>Please click a location on the map behind this dialog to set the <strong>{isPickingStart ? 'Starting' : 'Ending'}</strong> point.</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-2 mb-4">
             <Button 
               onClick={fetchRouteAndStops} 
               disabled={!routeStart || !routeEnd || isFetchingRoute}
               className="bg-[#1976d2] hover:bg-[#1565c0] text-white w-full max-w-xs"
             >
               {isFetchingRoute ? <><Loader2 size={16} className="mr-2 animate-spin" /> Generating Route...</> : "Verify Route & Find Stops"}
             </Button>
             {routeShape.length > 0 && !isFetchingRoute && (
               <p className="text-[10px] text-green-600 font-medium">Route displayed on map for verification</p>
             )}
          </div>

          {generatedStops.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Found {generatedStops.length} Potential Stops</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setGeneratedStops(prev => prev.map(s => ({...s, selected: true})))}>Select All</Button>
                  <Button variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => setGeneratedStops(prev => prev.map(s => ({...s, selected: false})))}>Deselect All</Button>
                </div>
              </div>
              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-2">
                  {generatedStops.map((stop, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-md border-b last:border-0">
                      <Checkbox 
                        checked={stop.selected} 
                        onCheckedChange={(checked) => {
                          const next = [...generatedStops];
                          next[idx].selected = !!checked;
                          setGeneratedStops(next);
                        }}
                        id={`gen-stop-${idx}`}
                      />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`gen-stop-${idx}`} className="font-medium text-sm block cursor-pointer">{stop.name}</Label>
                        <p className="text-[10px] text-gray-400 truncate">{stop.instruction}</p>
                      </div>
                      <div className="text-[10px] text-gray-400 flex-shrink-0">
                        {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGenerating(false)}>Cancel</Button>
            <Button 
              onClick={handleImportStops} 
              disabled={saving || generatedStops.filter(s => s.selected).length === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? 'Importing...' : `Import ${generatedStops.filter(s => s.selected).length} Stops`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
