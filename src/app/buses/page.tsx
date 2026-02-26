'use client';
import { useState } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray, createItem, updateItem, deleteItem } from '@/lib/firebaseHelpers';
import { Bus, Route, Trip } from '@/types';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, Bus as BusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const emptyBus = (): Omit<Bus, 'id'> => ({
  registration_number: '', operator: 'BSRTC', bus_type: 'ordinary',
  total_seats: 52, assigned_route_id: '', current_trip_id: null, status: 'active',
});

export default function BusesPage() {
  const { data: busesRaw, loading } = useRealtimeData<Record<string, Bus>>('/buses');
  const { data: routesRaw } = useRealtimeData<Record<string, Route>>('/routes');
  const { data: tripsRaw } = useRealtimeData<Record<string, Trip>>('/trips');

  const buses = objectToArray<Bus>(busesRaw);
  const routes = objectToArray<Route>(routesRaw);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editBus, setEditBus] = useState<(Omit<Bus, 'id'> & { id?: string }) | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = buses.filter((b) => {
    const reg = b.registration_number || '';
    const s = search || '';
    const matchSearch = reg.toLowerCase().includes(s.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSave = async () => {
    if (!editBus) return;
    if (!editBus.registration_number.trim()) { toast.error('Registration number required'); return; }
    setSaving(true);
    try {
      const data = { ...editBus };
      delete (data as { id?: string }).id;
      if (editBus.id) {
        await updateItem(`/buses/${editBus.id}`, data as Record<string, unknown>);
        toast.success('Bus updated');
      } else {
        await createItem('/buses', data as Record<string, unknown>);
        toast.success('Bus created');
      }
      setEditBus(null);
    } catch {
      toast.error('Failed to save bus');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const bus = buses.find((b) => b.id === deleteId);
    if (bus?.current_trip_id) { toast.error('Cannot delete - bus is on active trip'); setDeleteId(null); return; }
    // Also check trips
    const activeTrip = tripsRaw && Object.values(tripsRaw).find((t) => t.bus_id === deleteId && t.status === 'in_progress');
    if (activeTrip) { toast.error('Cannot delete - bus has active trip'); setDeleteId(null); return; }
    try {
      await deleteItem(`/buses/${deleteId}`);
      toast.success('Bus deleted');
    } catch {
      toast.error('Failed to delete bus');
    } finally {
      setDeleteId(null);
    }
  };

  const getRouteName = (id?: string | null) => routes.find((r) => r.id === id)?.route_name || '—';

  const typeBadge = (type: Bus['bus_type']) => {
    const map = { ordinary: 'bg-gray-100 text-gray-700', express: 'bg-blue-100 text-blue-700', AC: 'bg-purple-100 text-purple-700' };
    return <Badge className={cn('text-xs', map[type] || '')} variant="outline">{type}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by registration..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setEditBus(emptyBus())} size="sm" className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
          <Plus size={15} className="mr-1" /> Add Bus
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <BusIcon size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No buses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">Registration</th>
                    <th className="px-4 py-2.5 text-left font-medium">Type</th>
                    <th className="px-4 py-2.5 text-left font-medium">Seats</th>
                    <th className="px-4 py-2.5 text-left font-medium">Operator</th>
                    <th className="px-4 py-2.5 text-left font-medium">Assigned Route</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bus) => (
                    <tr key={bus.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{bus.registration_number}</td>
                      <td className="px-4 py-3">{typeBadge(bus.bus_type)}</td>
                      <td className="px-4 py-3 text-gray-600">{bus.total_seats}</td>
                      <td className="px-4 py-3 text-gray-600">{bus.operator}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{getRouteName(bus.assigned_route_id)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn('text-xs', bus.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200')}>
                          {bus.status === 'active' ? 'Active' : 'Maintenance'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditBus({ ...bus })} aria-label="Edit bus">
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteId(bus.id)} aria-label="Delete bus">
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
      <Dialog open={!!editBus} onOpenChange={(o) => !o && setEditBus(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editBus?.id ? 'Edit Bus' : 'Add New Bus'}</DialogTitle>
          </DialogHeader>
          {editBus && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Registration Number *</Label>
                  <Input value={editBus.registration_number} onChange={(e) => setEditBus({ ...editBus, registration_number: e.target.value })} placeholder="e.g. BR01PA1234" />
                </div>
                <div className="space-y-1">
                  <Label>Operator</Label>
                  <Input value={editBus.operator} onChange={(e) => setEditBus({ ...editBus, operator: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Bus Type</Label>
                  <Select value={editBus.bus_type} onValueChange={(v) => setEditBus({ ...editBus, bus_type: v as Bus['bus_type'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ordinary">Ordinary</SelectItem>
                      <SelectItem value="express">Express</SelectItem>
                      <SelectItem value="AC">AC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Total Seats</Label>
                  <Input type="number" value={editBus.total_seats} onChange={(e) => setEditBus({ ...editBus, total_seats: +e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={editBus.status} onValueChange={(v) => setEditBus({ ...editBus, status: v as Bus['status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Assigned Route</Label>
                    <Select value={editBus.assigned_route_id || 'none'} onValueChange={(v) => setEditBus({ ...editBus, assigned_route_id: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.route_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBus(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
              {saving ? 'Saving...' : 'Save Bus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bus?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this bus. This action cannot be undone.</AlertDialogDescription>
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
