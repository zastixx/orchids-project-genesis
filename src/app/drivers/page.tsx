'use client';
import { useState } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray, createItem, updateItem } from '@/lib/firebaseHelpers';
import { Driver, Bus, Route } from '@/types';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format, isValid } from 'date-fns';
import { Plus, Search, Pencil, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const emptyDriver = (): Omit<Driver, 'id'> => ({
  user_id: '', employee_id: '', name: '', phone: '',
  assigned_bus_id: '', assigned_route_id: '',
  current_trip_id: null, duty_status: 'off_duty',
  total_trips_completed: 0, license_number: '',
  license_expiry: '',
});

export default function DriversPage() {
  const { data: driversRaw, loading } = useRealtimeData<Record<string, Driver>>('/drivers');
  const { data: busesRaw } = useRealtimeData<Record<string, Bus>>('/buses');
  const { data: routesRaw } = useRealtimeData<Record<string, Route>>('/routes');

  const drivers = objectToArray<Driver>(driversRaw);
  const buses = objectToArray<Bus>(busesRaw);
  const routes = objectToArray<Route>(routesRaw);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editDriver, setEditDriver] = useState<(Omit<Driver, 'id'> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const getLicenseStatus = (expiry: string) => {
    if (!expiry) return null;
    const parsed = parseISO(expiry);
    if (!isValid(parsed)) return null;
    const days = differenceInDays(parsed, new Date());
    if (days < 0) return 'expired';
    if (days < 90) return 'expiring';
    return 'valid';
  };

  const filtered = drivers.filter((d) => {
    const nameMatch = (d.name || '').toLowerCase().includes((search || '').toLowerCase());
    const empMatch = (d.employee_id || '').toLowerCase().includes((search || '').toLowerCase());
    const matchSearch = nameMatch || empMatch;
    const matchStatus = filterStatus === 'all' || d.duty_status === filterStatus ||
      (filterStatus === 'expiring' && (getLicenseStatus(d.license_expiry) === 'expiring' || getLicenseStatus(d.license_expiry) === 'expired'));
    return matchSearch && matchStatus;
  });

  const handleSave = async () => {
    if (!editDriver) return;
    if (!editDriver.name.trim()) { toast.error('Name is required'); return; }
    if (!editDriver.employee_id.trim()) { toast.error('Employee ID is required'); return; }
    setSaving(true);
    try {
      const data = { ...editDriver };
      delete (data as { id?: string }).id;
      if (editDriver.id) {
        await updateItem(`/drivers/${editDriver.id}`, data as Record<string, unknown>);
        toast.success('Driver updated');
      } else {
        await createItem('/drivers', data as Record<string, unknown>);
        toast.success('Driver created');
      }
      setEditDriver(null);
    } catch {
      toast.error('Failed to save driver');
    } finally {
      setSaving(false);
    }
  };

  const dutyBadge = (status: Driver['duty_status']) => {
    if (status === 'on_duty') return <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">On Duty</Badge>;
    if (status === 'on_break') return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200" variant="outline">On Break</Badge>;
    return <Badge className="bg-gray-100 text-gray-600 border-gray-200" variant="outline">Off Duty</Badge>;
  };

  const getBusName = (id?: string) => buses.find((b) => b.id === id)?.registration_number || '—';
  const getRouteName = (id?: string) => routes.find((r) => r.id === id)?.route_name || '—';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name or employee ID..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Drivers</SelectItem>
            <SelectItem value="on_duty">On Duty</SelectItem>
            <SelectItem value="off_duty">Off Duty</SelectItem>
            <SelectItem value="on_break">On Break</SelectItem>
            <SelectItem value="expiring">License Expiring</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setEditDriver(emptyDriver())} size="sm" className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
          <Plus size={15} className="mr-1" /> Add Driver
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <Users size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No drivers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium">Employee ID</th>
                    <th className="px-4 py-2.5 text-left font-medium">Phone</th>
                    <th className="px-4 py-2.5 text-left font-medium">Bus</th>
                    <th className="px-4 py-2.5 text-left font-medium">Route</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Trips</th>
                    <th className="px-4 py-2.5 text-left font-medium">License Expiry</th>
                    <th className="px-4 py-2.5 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((driver) => {
                    const licStatus = getLicenseStatus(driver.license_expiry);
                    return (
                      <tr key={driver.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{driver.name}</td>
                        <td className="px-4 py-3 text-gray-600">{driver.employee_id}</td>
                        <td className="px-4 py-3 text-gray-600">{driver.phone}</td>
                        <td className="px-4 py-3 text-gray-600">{getBusName(driver.assigned_bus_id)}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">{getRouteName(driver.assigned_route_id)}</td>
                        <td className="px-4 py-3">{dutyBadge(driver.duty_status)}</td>
                        <td className="px-4 py-3 text-gray-600">{driver.total_trips_completed}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-xs', licStatus === 'expired' ? 'text-red-600 font-medium' : licStatus === 'expiring' ? 'text-orange-600' : 'text-gray-600')}>
                              {driver.license_expiry ? format(parseISO(driver.license_expiry), 'dd MMM yyyy') : '—'}
                            </span>
                            {licStatus === 'expired' && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs" variant="outline">EXPIRED</Badge>}
                            {licStatus === 'expiring' && <AlertTriangle size={12} className="text-orange-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDriver({ ...driver })} aria-label="Edit driver">
                            <Pencil size={13} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Add Dialog */}
      <Dialog open={!!editDriver} onOpenChange={(o) => !o && setEditDriver(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDriver?.id ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
          </DialogHeader>
          {editDriver && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Full Name *</Label>
                  <Input value={editDriver.name} onChange={(e) => setEditDriver({ ...editDriver, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Employee ID *</Label>
                  <Input value={editDriver.employee_id} onChange={(e) => setEditDriver({ ...editDriver, employee_id: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Phone Number</Label>
                  <Input value={editDriver.phone} onChange={(e) => setEditDriver({ ...editDriver, phone: e.target.value })} placeholder="+91XXXXXXXXXX" />
                </div>
                <div className="space-y-1">
                  <Label>License Number *</Label>
                  <Input value={editDriver.license_number} onChange={(e) => setEditDriver({ ...editDriver, license_number: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>License Expiry *</Label>
                  <Input type="date" value={editDriver.license_expiry} onChange={(e) => setEditDriver({ ...editDriver, license_expiry: e.target.value })} />
                </div>
                  <div className="space-y-1">
                    <Label>Assigned Bus</Label>
                    <Select value={editDriver.assigned_bus_id || 'none'} onValueChange={(v) => setEditDriver({ ...editDriver, assigned_bus_id: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Select bus" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {buses.map((b) => <SelectItem key={b.id} value={b.id}>{b.registration_number}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Assigned Route</Label>
                    <Select value={editDriver.assigned_route_id || 'none'} onValueChange={(v) => setEditDriver({ ...editDriver, assigned_route_id: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.route_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                <div className="space-y-1">
                  <Label>Duty Status</Label>
                  <Select value={editDriver.duty_status} onValueChange={(v) => setEditDriver({ ...editDriver, duty_status: v as Driver['duty_status'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_duty">On Duty</SelectItem>
                      <SelectItem value="off_duty">Off Duty</SelectItem>
                      <SelectItem value="on_break">On Break</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDriver(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1976d2] hover:bg-[#1565c0] text-white">
              {saving ? 'Saving...' : 'Save Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
