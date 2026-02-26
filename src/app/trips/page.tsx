'use client';
import { useState, useMemo } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray } from '@/lib/firebaseHelpers';
import { Trip, Route, Bus, Driver } from '@/types';
import { format, fromUnixTime, isValid, parseISO } from 'date-fns';
import { Download, Search, Eye, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

const statusColors: Record<string, string> = {
  completed: 'bg-green-100 text-green-700 border-green-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  scheduled: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

function formatTimestamp(ts: number | null | undefined): string {
  if (!ts) return '—';
  const d = ts > 1e10 ? new Date(ts) : fromUnixTime(ts);
  return isValid(d) ? format(d, 'dd MMM, HH:mm') : '—';
}

function calcDuration(trip: Trip): string {
  if (!trip.actual_departure || !trip.actual_arrival) return '—';
  const mins = Math.round((trip.actual_arrival - trip.actual_departure) / 60000);
  if (mins < 0) return '—';
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function TripsPage() {
  const { data: tripsRaw, loading } = useRealtimeData<Record<string, Trip>>('/trips');
  const { data: routesRaw } = useRealtimeData<Record<string, Route>>('/routes');
  const { data: busesRaw } = useRealtimeData<Record<string, Bus>>('/buses');
  const { data: driversRaw } = useRealtimeData<Record<string, Driver>>('/drivers');

  const trips = objectToArray<Trip>(tripsRaw);
  const routes = objectToArray<Route>(routesRaw);
  const buses = objectToArray<Bus>(busesRaw);
  const drivers = objectToArray<Driver>(driversRaw);

  const [search, setSearch] = useState('');
  const [filterRoute, setFilterRoute] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const getRoute = (id: string) => routes.find((r) => r.id === id);
  const getBus = (id: string) => buses.find((b) => b.id === id);
  const getDriver = (id: string) => drivers.find((d) => d.id === id);

  const filtered = useMemo(() => {
    return trips
      .filter((t) => {
        const matchStatus = filterStatus === 'all' || t.status === filterStatus;
        const matchRoute = filterRoute === 'all' || t.route_id === filterRoute;
        const route = getRoute(t.route_id);
        const bus = getBus(t.bus_id);
        const searchLower = (search || '').toLowerCase();
        const matchSearch =
          !search ||
          (t.trip_id || '').toLowerCase().includes(searchLower) ||
          (route?.route_name || '').toLowerCase().includes(searchLower) ||
          (bus?.registration_number || '').toLowerCase().includes(searchLower);
        return matchStatus && matchRoute && matchSearch;
      })
      .sort((a, b) => (b.scheduled_departure || 0) - (a.scheduled_departure || 0));
  }, [trips, filterStatus, filterRoute, search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Summary stats
  const completed = filtered.filter((t) => t.status === 'completed').length;
  const onTime = filtered.filter((t) => t.status === 'completed' && (t.delay_minutes || 0) <= 5).length;
  const onTimePct = completed > 0 ? Math.round((onTime / completed) * 100) : 0;

  const exportCSV = () => {
    const rows = [
      ['Trip ID', 'Route', 'Direction', 'Bus', 'Driver', 'Status', 'Scheduled', 'Duration', 'Delay (min)'],
      ...filtered.map((t) => [
        t.trip_id,
        getRoute(t.route_id)?.route_name || t.route_id,
        t.direction,
        getBus(t.bus_id)?.registration_number || t.bus_id,
        getDriver(t.driver_id)?.name || t.driver_id,
        t.status,
        formatTimestamp(t.scheduled_departure),
        calcDuration(t),
        String(t.delay_minutes || 0),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'trips.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search trips..." className="pl-8 h-8 text-sm" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={filterRoute} onValueChange={(v) => { setFilterRoute(v); setPage(1); }}>
          <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="All Routes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Routes</SelectItem>
            {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.route_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={exportCSV} className="h-8">
          <Download size={13} className="mr-1" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Trips', value: filtered.length },
          { label: 'Completed', value: completed },
          { label: 'On-Time %', value: `${onTimePct}%` },
          { label: 'In Progress', value: filtered.filter((t) => t.status === 'in_progress').length },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold text-gray-800">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : paginated.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <List size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No trips found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">Trip ID</th>
                    <th className="px-4 py-2.5 text-left font-medium">Scheduled</th>
                    <th className="px-4 py-2.5 text-left font-medium">Route</th>
                    <th className="px-4 py-2.5 text-left font-medium">Dir</th>
                    <th className="px-4 py-2.5 text-left font-medium">Bus</th>
                    <th className="px-4 py-2.5 text-left font-medium">Driver</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium">Duration</th>
                    <th className="px-4 py-2.5 text-left font-medium">Delay</th>
                    <th className="px-4 py-2.5 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((trip) => {
                    const route = getRoute(trip.route_id);
                    const bus = getBus(trip.bus_id);
                    const driver = getDriver(trip.driver_id);
                    return (
                      <tr key={trip.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{trip.trip_id?.slice(0, 12) || trip.id.slice(0, 12)}</td>
                        <td className="px-4 py-3 text-xs">{formatTimestamp(trip.scheduled_departure)}</td>
                        <td className="px-4 py-3 max-w-[140px] truncate text-xs">{route?.route_name || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{trip.direction}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">{bus?.registration_number || '—'}</td>
                        <td className="px-4 py-3 text-xs">{driver?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn('text-xs capitalize', statusColors[trip.status] || '')}>{trip.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs">{calcDuration(trip)}</td>
                        <td className="px-4 py-3 text-xs">
                          {trip.delay_minutes > 0 ? (
                            <span className="text-red-600 font-medium">+{trip.delay_minutes}m</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedTrip(trip)} aria-label="View trip details">
                            <Eye size={13} />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t text-sm">
              <span className="text-gray-500 text-xs">Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Prev</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trip Detail Modal */}
      <Dialog open={!!selectedTrip} onOpenChange={(o) => !o && setSelectedTrip(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Trip Details</DialogTitle>
          </DialogHeader>
          {selectedTrip && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Trip ID', value: selectedTrip.trip_id || selectedTrip.id },
                  { label: 'Route', value: getRoute(selectedTrip.route_id)?.route_name || '—' },
                  { label: 'Direction', value: selectedTrip.direction },
                  { label: 'Bus', value: getBus(selectedTrip.bus_id)?.registration_number || '—' },
                  { label: 'Driver', value: getDriver(selectedTrip.driver_id)?.name || '—' },
                  { label: 'Status', value: selectedTrip.status },
                  { label: 'Scheduled', value: formatTimestamp(selectedTrip.scheduled_departure) },
                  { label: 'Actual Departure', value: formatTimestamp(selectedTrip.actual_departure) },
                  { label: 'Actual Arrival', value: formatTimestamp(selectedTrip.actual_arrival) },
                  { label: 'Duration', value: calcDuration(selectedTrip) },
                  { label: 'Delay', value: selectedTrip.delay_minutes > 0 ? `+${selectedTrip.delay_minutes} min` : 'On time' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-2 bg-gray-50 rounded">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-medium text-gray-800 truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
