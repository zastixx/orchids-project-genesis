'use client';
import { useMemo, useState } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray } from '@/lib/firebaseHelpers';
import { Trip, Driver, Bus, Route } from '@/types';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, fromUnixTime, subDays, isAfter, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#1976d2', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'];

function ChartCard({ title, children, loading }: { title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-gray-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? <Skeleton className="h-40 w-full" /> : children}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { data: tripsRaw, loading: tripsLoading } = useRealtimeData<Record<string, Trip>>('/trips');
  const { data: driversRaw } = useRealtimeData<Record<string, Driver>>('/drivers');
  const { data: busesRaw } = useRealtimeData<Record<string, Bus>>('/buses');
  const { data: routesRaw } = useRealtimeData<Record<string, Route>>('/routes');

  const trips = objectToArray<Trip>(tripsRaw);
  const drivers = objectToArray<Driver>(driversRaw);
  const buses = objectToArray<Bus>(busesRaw);
  const routes = objectToArray<Route>(routesRaw);

  const [dateRange, setDateRange] = useState('7');
  const days = parseInt(dateRange);

  const filteredTrips = useMemo(() => {
    const cutoff = subDays(new Date(), days);
    return trips.filter((t) => {
      if (!t.scheduled_departure) return false;
      const d = t.scheduled_departure > 1e10 ? new Date(t.scheduled_departure) : fromUnixTime(t.scheduled_departure);
      return isValid(d) && isAfter(d, cutoff);
    });
  }, [trips, days]);

  // Trips per day
  const tripsPerDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      map.set(format(d, 'MMM dd'), 0);
    }
    filteredTrips.forEach((t) => {
      const d = t.scheduled_departure > 1e10 ? new Date(t.scheduled_departure) : fromUnixTime(t.scheduled_departure);
      if (isValid(d)) {
        const key = format(d, 'MMM dd');
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }, [filteredTrips, days]);

  // By route
  const tripsByRoute = useMemo(() => {
    const map = new Map<string, number>();
    filteredTrips.forEach((t) => {
      const name = routes.find((r) => r.id === t.route_id)?.route_name || t.route_id;
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([route, count]) => ({ route: route.length > 20 ? route.slice(0, 20) + '…' : route, count }))
      .sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filteredTrips, routes]);

  // By status
  const tripsByStatus = useMemo(() => {
    const map = new Map<string, number>();
    filteredTrips.forEach((t) => { map.set(t.status, (map.get(t.status) || 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredTrips]);

  // Most delayed routes
  const delayedRoutes = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    filteredTrips.forEach((t) => {
      const name = routes.find((r) => r.id === t.route_id)?.route_name || t.route_id;
      const entry = map.get(name) || { total: 0, count: 0 };
      map.set(name, { total: entry.total + (t.delay_minutes || 0), count: entry.count + 1 });
    });
    return Array.from(map.entries())
      .map(([route, { total, count }]) => ({ route: route.length > 20 ? route.slice(0, 20) + '…' : route, avgDelay: Math.round(total / count) }))
      .sort((a, b) => b.avgDelay - a.avgDelay).slice(0, 8);
  }, [filteredTrips, routes]);

  // Driver performance
  const driverPerf = useMemo(() => {
    const map = new Map<string, { total: number; delay: number; onTime: number }>();
    filteredTrips.forEach((t) => {
      const name = drivers.find((d) => d.id === t.driver_id)?.name || t.driver_id;
      const entry = map.get(name) || { total: 0, delay: 0, onTime: 0 };
      map.set(name, {
        total: entry.total + 1,
        delay: entry.delay + (t.delay_minutes || 0),
        onTime: entry.onTime + ((t.delay_minutes || 0) <= 5 ? 1 : 0),
      });
    });
    return Array.from(map.entries())
      .map(([name, { total, delay, onTime }]) => ({
        name,
        totalTrips: total,
        avgDelay: total > 0 ? Math.round(delay / total) : 0,
        onTimePct: total > 0 ? Math.round((onTime / total) * 100) : 0,
      }))
      .sort((a, b) => b.totalTrips - a.totalTrips).slice(0, 10);
  }, [filteredTrips, drivers]);

  // Bus utilization
  const busUtil = useMemo(() => {
    const map = new Map<string, number>();
    filteredTrips.forEach((t) => {
      const reg = buses.find((b) => b.id === t.bus_id)?.registration_number || t.bus_id;
      map.set(reg, (map.get(reg) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([bus, trips]) => ({ bus, trips }))
      .sort((a, b) => b.trips - a.trips).slice(0, 8);
  }, [filteredTrips, buses]);

  const loading = tripsLoading;

  return (
    <div className="space-y-5">
      {/* Date range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Analytics Overview</h2>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Section 1: Trip Overview */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Trip Overview</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <ChartCard title="Trips Per Day" loading={loading}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={tripsPerDay} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1976d2" strokeWidth={2} dot={false} name="Trips" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Trips by Route" loading={loading}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tripsByRoute} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="route" tick={{ fontSize: 9 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" fill="#1976d2" name="Trips" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Trips by Status" loading={loading}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={tripsByStatus} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {tripsByStatus.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Section 2: Performance */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Performance Metrics</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ChartCard title="Most Delayed Routes (avg minutes)" loading={loading}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={delayedRoutes} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="route" tick={{ fontSize: 9 }} width={80} />
                <Tooltip />
                <Bar dataKey="avgDelay" fill="#ff9800" name="Avg Delay (min)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Bus Utilization (trips per bus)" loading={loading}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={busUtil} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bus" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="trips" fill="#4caf50" name="Trips" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Section 3: Driver Performance */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Driver Performance</h3>
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : driverPerf.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">No driver data for selected period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs text-gray-500">
                      <th className="px-4 py-2.5 text-left font-medium">Driver</th>
                      <th className="px-4 py-2.5 text-left font-medium">Total Trips</th>
                      <th className="px-4 py-2.5 text-left font-medium">Avg Delay (min)</th>
                      <th className="px-4 py-2.5 text-left font-medium">On-Time %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverPerf.map((d) => (
                      <tr key={d.name} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{d.name}</td>
                        <td className="px-4 py-2.5 text-gray-600">{d.totalTrips}</td>
                        <td className="px-4 py-2.5">
                          <span className={d.avgDelay > 10 ? 'text-red-600' : d.avgDelay > 5 ? 'text-orange-600' : 'text-green-600'}>
                            {d.avgDelay > 0 ? `+${d.avgDelay}` : d.avgDelay}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={d.onTimePct >= 90 ? 'text-green-600 font-medium' : d.onTimePct >= 70 ? 'text-orange-600' : 'text-red-600'}>
                            {d.onTimePct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
