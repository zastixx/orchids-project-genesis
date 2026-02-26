'use client';
import { useState } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray, createItem, updateItem, deleteItem } from '@/lib/firebaseHelpers';
import { Route, Stop, RouteSegment } from '@/types';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

const emptyRoute = (): Omit<Route, 'id'> => ({
  route_name: '',
  route_type: 'shuttle',
  certain_stops_up: [],
  certain_stops_down: [],
  segments: [],
  typical_daily_trips: 6,
  first_departure: '06:00',
  last_departure: '18:00',
});

function generateSegments(stopIds: string[]): RouteSegment[] {
  const segs: RouteSegment[] = [];
  for (let i = 0; i < stopIds.length - 1; i++) {
    segs.push({ from: stopIds[i], to: stopIds[i + 1], distance_km: 0, avg_duration_min: 0 });
  }
  return segs;
}

export default function RoutesPage() {
  const { data: routesRaw, loading } = useRealtimeData<Record<string, Route>>('/routes');
  const { data: stopsRaw } = useRealtimeData<Record<string, Stop>>('/stops');
  const { data: tripsRaw } = useRealtimeData<Record<string, { route_id: string; status: string }>>('/trips');

  const routes = objectToArray<Route>(routesRaw);
  const stops = objectToArray<Stop>(stopsRaw);

  const [search, setSearch] = useState('');
  const [editRoute, setEditRoute] = useState<(Omit<Route, 'id'> & { id?: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = routes.filter((r) =>
    (r.route_name || '').toLowerCase().includes((search || '').toLowerCase())
  );

  const totalDistance = (route: Route) =>
    (route.segments || []).reduce((acc, s) => acc + (s.distance_km || 0), 0).toFixed(1);

  const openAdd = () => setEditRoute(emptyRoute());
  const openEdit = (route: Route) => setEditRoute({ ...route });

  const handleSave = async () => {
    if (!editRoute) return;
    if (!editRoute.route_name.trim()) { toast.error('Route name is required'); return; }
    if ((editRoute.certain_stops_up?.length || 0) < 2) { toast.error('At least 2 stops required'); return; }
    setSaving(true);
    try {
      const data = { ...editRoute };
      delete (data as { id?: string }).id;
      if (editRoute.id) {
        await updateItem(`/routes/${editRoute.id}`, data as Record<string, unknown>);
        toast.success('Route updated');
      } else {
        await createItem('/routes', data as Record<string, unknown>);
        toast.success('Route created');
      }
      setEditRoute(null);
    } catch {
      toast.error('Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const trips = tripsRaw ? Object.values(tripsRaw) : [];
    const active = trips.find((t) => t.route_id === deleteId && t.status === 'in_progress');
    if (active) { toast.error('Cannot delete - active trips exist'); setDeleteId(null); return; }
    try {
      await deleteItem(`/routes/${deleteId}`);
      toast.success('Route deleted');
    } catch {
      toast.error('Failed to delete route');
    } finally {
      setDeleteId(null);
    }
  };

  const getStopName = (id: string) => stops.find((s) => s.id === id)?.name || id;

  const handleStopToggle = (stopId: string, direction: 'up' | 'down') => {
    if (!editRoute) return;
    const key = direction === 'up' ? 'certain_stops_up' : 'certain_stops_down';
    const current = editRoute[key] || [];
    const updated = current.includes(stopId)
      ? current.filter((s) => s !== stopId)
      : [...current, stopId];
    const newRoute = { ...editRoute, [key]: updated };
    newRoute.segments = generateSegments(newRoute.certain_stops_up || []);
    setEditRoute(newRoute);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search routes..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={openAdd} size="sm" className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
          <Plus size={15} className="mr-1" /> Add Route
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <RouteIcon size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No routes found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">Route Name</th>
                    <th className="px-4 py-2.5 text-left font-medium">Type</th>
                    <th className="px-4 py-2.5 text-left font-medium">Daily Trips</th>
                    <th className="px-4 py-2.5 text-left font-medium">Total Distance</th>
                    <th className="px-4 py-2.5 text-left font-medium">Stops</th>
                    <th className="px-4 py-2.5 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((route) => (
                    <tr key={route.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{route.route_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs capitalize">{route.route_type}</Badge>
                      </td>
                      <td className="px-4 py-3">{route.typical_daily_trips}</td>
                      <td className="px-4 py-3">{totalDistance(route)} km</td>
                      <td className="px-4 py-3">{route.certain_stops_up?.length || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(route)} aria-label="Edit route">
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => setDeleteId(route.id)} aria-label="Delete route">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Add Dialog */}
      <Dialog open={!!editRoute} onOpenChange={(o) => !o && setEditRoute(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRoute?.id ? 'Edit Route' : 'Add New Route'}</DialogTitle>
          </DialogHeader>
          {editRoute && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Route Name *</Label>
                  <Input value={editRoute.route_name} onChange={(e) => setEditRoute({ ...editRoute, route_name: e.target.value })} placeholder="e.g. Raxaul - Bettiah" />
                </div>
                <div className="space-y-1">
                  <Label>Route Type</Label>
                  <Select value={editRoute.route_type} onValueChange={(v) => setEditRoute({ ...editRoute, route_type: v as Route['route_type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shuttle">Shuttle</SelectItem>
                      <SelectItem value="express">Express</SelectItem>
                      <SelectItem value="limited">Limited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Daily Trips</Label>
                  <Input type="number" value={editRoute.typical_daily_trips} onChange={(e) => setEditRoute({ ...editRoute, typical_daily_trips: +e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>First Departure</Label>
                  <Input type="time" value={editRoute.first_departure} onChange={(e) => setEditRoute({ ...editRoute, first_departure: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Last Departure</Label>
                  <Input type="time" value={editRoute.last_departure} onChange={(e) => setEditRoute({ ...editRoute, last_departure: e.target.value })} />
                </div>
              </div>

              {/* Stops UP */}
              <div className="space-y-1">
                <Label>Stops (UP direction) *</Label>
                <p className="text-xs text-gray-400">Select stops in order from start to end</p>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[40px]">
                  {(editRoute.certain_stops_up || []).map((sId, idx) => (
                    <Badge key={sId} variant="secondary" className="text-xs cursor-pointer" onClick={() => handleStopToggle(sId, 'up')}>
                      {idx + 1}. {getStopName(sId)} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                  {stops.filter((s) => !(editRoute.certain_stops_up || []).includes(s.id)).map((s) => (
                    <Badge key={s.id} variant="outline" className="text-xs cursor-pointer hover:bg-gray-100" onClick={() => handleStopToggle(s.id, 'up')}>
                      + {s.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Segments */}
              {(editRoute.segments || []).length > 0 && (
                <div className="space-y-1">
                  <Label>Segments</Label>
                  <div className="space-y-2">
                    {editRoute.segments.map((seg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 text-gray-600 truncate">{getStopName(seg.from)} → {getStopName(seg.to)}</span>
                        <Input
                          className="w-20 h-7 text-xs"
                          type="number"
                          placeholder="km"
                          value={seg.distance_km || ''}
                          onChange={(e) => {
                            const segs = [...editRoute.segments];
                            segs[idx] = { ...segs[idx], distance_km: +e.target.value };
                            setEditRoute({ ...editRoute, segments: segs });
                          }}
                        />
                        <Input
                          className="w-20 h-7 text-xs"
                          type="number"
                          placeholder="min"
                          value={seg.avg_duration_min || ''}
                          onChange={(e) => {
                            const segs = [...editRoute.segments];
                            segs[idx] = { ...segs[idx], avg_duration_min: +e.target.value };
                            setEditRoute({ ...editRoute, segments: segs });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoute(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
              {saving ? 'Saving...' : 'Save Route'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
