'use client';
import { useState } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray, createItem, updateItem, deleteItem } from '@/lib/firebaseHelpers';
import { Driver, Bus, Route, Trip } from '@/types';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format, isValid } from 'date-fns';
import { Plus, Search, Pencil, Users, AlertTriangle, Trash2, IdCard, Phone, Bus as BusIcon, MapPin, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const { data: tripsRaw } = useRealtimeData<Record<string, Trip>>('/trips');

    const drivers = objectToArray<Driver>(driversRaw).map(d => ({
      ...d,
      employee_id: d.employee_id || d.emp_id || '',
      phone: d.phone || d.phone_no || '',
      assigned_bus_id: d.assigned_bus_id || d.bus_id || '',
      assigned_route_id: d.assigned_route_id || d.route_id || '',
      current_trip_id: d.current_trip_id || d.trip_id || null,
    }));
    const buses = objectToArray<Bus>(busesRaw);

  const routes = objectToArray<Route>(routesRaw);
  const trips = objectToArray<Trip>(tripsRaw);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editDriver, setEditDriver] = useState<(Omit<Driver, 'id'> & { id?: string }) | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
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
    const phoneMatch = (d.phone || '').toLowerCase().includes((search || '').toLowerCase());
    const matchSearch = nameMatch || empMatch || phoneMatch;
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

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteItem(`/drivers/${deleteConfirm}`);
      toast.success('Driver deleted');
      setDeleteConfirm(null);
    } catch {
      toast.error('Failed to delete driver');
    }
  };

  const dutyBadge = (status: Driver['duty_status']) => {
    if (status === 'on_duty') return <Badge className="bg-green-100 text-green-700 border-green-200" variant="outline">On Duty</Badge>;
    if (status === 'on_break') return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200" variant="outline">On Break</Badge>;
    return <Badge className="bg-gray-100 text-gray-600 border-gray-200" variant="outline">Off Duty</Badge>;
  };

  const getBusName = (id?: string) => buses.find((b) => b.id === id)?.registration_number || '—';
  const getRouteName = (id?: string) => routes.find((r) => r.id === id)?.route_name || '—';
  const getTripInfo = (tripId?: string | null) => {
    if (!tripId) return null;
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return 'In Progress';
    const route = routes.find(r => r.id === trip.route_id);
    return `${route?.route_name || 'Route'} (${trip.direction})`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by name, Emp ID, or phone..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <th className="px-4 py-2.5 text-left font-medium">Driver Details</th>
                    <th className="px-4 py-2.5 text-left font-medium">Assignment</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status & Trip</th>
                    <th className="px-4 py-2.5 text-left font-medium">License Info</th>
                    <th className="px-4 py-2.5 text-right font-medium pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((driver) => {
                    const licStatus = getLicenseStatus(driver.license_expiry);
                    const currentTrip = getTripInfo(driver.current_trip_id);
                    return (
                      <tr key={driver.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{driver.name}</span>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="flex items-center text-[11px] text-gray-500">
                                <IdCard size={10} className="mr-1" /> {driver.employee_id}
                              </span>
                              <span className="flex items-center text-[11px] text-gray-500">
                                <Phone size={10} className="mr-1" /> {driver.phone || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center text-xs text-gray-700">
                              <BusIcon size={12} className="mr-1.5 text-blue-500" />
                              <span className="font-medium">{getBusName(driver.assigned_bus_id)}</span>
                            </div>
                            <div className="flex items-center text-xs text-gray-700">
                              <MapPin size={12} className="mr-1.5 text-orange-500" />
                              <span className="max-w-[120px] truncate" title={getRouteName(driver.assigned_route_id)}>
                                {getRouteName(driver.assigned_route_id)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              {dutyBadge(driver.duty_status)}
                              <span className="text-[11px] text-gray-400 font-medium">
                                {driver.total_trips_completed || 0} trips
                              </span>
                            </div>
                            {currentTrip && (
                              <div className="flex flex-col bg-blue-50/50 p-1.5 rounded border border-blue-100/50">
                                <span className="text-[9px] uppercase tracking-wider text-blue-500 font-bold">Live Trip</span>
                                <span className="text-xs text-blue-700 font-medium truncate max-w-[140px]">{currentTrip}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-mono text-gray-600">{driver.license_number || '—'}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-[11px]', 
                                licStatus === 'expired' ? 'text-red-600 font-bold' : 
                                licStatus === 'expiring' ? 'text-orange-600 font-medium' : 
                                'text-gray-500'
                              )}>
                                {driver.license_expiry ? format(parseISO(driver.license_expiry), 'dd MMM yyyy') : 'No Expiry'}
                              </span>
                              {licStatus === 'expired' && <Badge className="h-4 px-1 text-[8px] bg-red-100 text-red-700 border-red-200" variant="outline">EXPIRED</Badge>}
                              {licStatus === 'expiring' && <AlertTriangle size={10} className="text-orange-500" />}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditDriver({ ...driver })} className="cursor-pointer">
                                <Pencil size={14} className="mr-2" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => setDeleteConfirm(driver.id)} 
                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash2 size={14} className="mr-2" /> Delete Driver
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editDriver?.id ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
            <DialogDescription>
              Complete the driver profile. Ensure the employee ID and license number are correct.
            </DialogDescription>
          </DialogHeader>
          {editDriver && (
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide">Personal Information</Label>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50/50">
                  <div className="col-span-2 space-y-1">
                    <Label>Full Name *</Label>
                    <Input value={editDriver.name} onChange={(e) => setEditDriver({ ...editDriver, name: e.target.value })} placeholder="John Doe" />
                  </div>
                  <div className="space-y-1">
                    <Label>Employee ID *</Label>
                    <Input value={editDriver.employee_id} onChange={(e) => setEditDriver({ ...editDriver, employee_id: e.target.value })} placeholder="EMP-001" />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone Number</Label>
                    <Input value={editDriver.phone} onChange={(e) => setEditDriver({ ...editDriver, phone: e.target.value })} placeholder="+91XXXXXXXXXX" />
                  </div>
                </div>
              </div>

              <div className="col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide">License & Duty</Label>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50/50">
                  <div className="space-y-1">
                    <Label>License Number *</Label>
                    <Input value={editDriver.license_number} onChange={(e) => setEditDriver({ ...editDriver, license_number: e.target.value })} placeholder="DL-XXXX" />
                  </div>
                  <div className="space-y-1">
                    <Label>License Expiry *</Label>
                    <Input type="date" value={editDriver.license_expiry} onChange={(e) => setEditDriver({ ...editDriver, license_expiry: e.target.value })} />
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

              <div className="col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide">Work Assignment</Label>
                <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-gray-50/50">
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
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="bg-gray-50 -mx-6 -mb-6 p-4 border-t">
            <Button variant="outline" onClick={() => setEditDriver(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1976d2] hover:bg-[#1565c0] text-white px-8">
              {saving ? 'Saving...' : 'Save Driver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the driver profile for <strong>{drivers.find(d => d.id === deleteConfirm)?.name}</strong>. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete Driver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
