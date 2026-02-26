'use client';
import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { objectToArray } from '@/lib/firebaseHelpers';
import { LiveTracking, Driver, Bus, Route, Stop } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  Users,
  Bus as BusIcon,
  AlertTriangle,
  Wifi,
  WifiOff,
  ArrowUp,
  ArrowDown,
  Gauge,
  MapPin,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const BusMapModal = dynamic(() => import('@/components/BusMapModal'), { ssr: false });

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
            {loading ? (
              <Skeleton className="h-7 w-12 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
            )}
          </div>
          <div className={cn('p-2.5 rounded-xl', color)}>
            <Icon size={20} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TripStatusBadge({ tracking }: { tracking: LiveTracking }) {
  const now = Date.now();
  const lastUpdated = tracking.last_updated;
  const secsSinceUpdate = (now - lastUpdated) / 1000;

  if (!tracking.driver_online || secsSinceUpdate > 120) {
    return <Badge className="bg-red-100 text-red-700 border-red-200">SIGNAL LOST</Badge>;
  }
  return <Badge className="bg-green-100 text-green-700 border-green-200">RUNNING</Badge>;
}

export default function DashboardPage() {
  const { data: liveTrackingRaw, loading: liveLoading } = useRealtimeData<Record<string, LiveTracking>>('/live_tracking');
  const { data: driversRaw } = useRealtimeData<Record<string, Driver>>('/drivers');
  const { data: busesRaw } = useRealtimeData<Record<string, Bus>>('/buses');
  const { data: routesRaw } = useRealtimeData<Record<string, Route>>('/routes');
  const { data: stopsRaw } = useRealtimeData<Record<string, Stop>>('/stops');

  const [selectedTrip, setSelectedTrip] = useState<LiveTracking | null>(null);
  const router = useRouter();

  const liveTracking = objectToArray<LiveTracking>(liveTrackingRaw);
  const drivers = objectToArray<Driver>(driversRaw);
  const buses = objectToArray<Bus>(busesRaw);
  const routes = objectToArray<Route>(routesRaw);
  const stops = objectToArray<Stop>(stopsRaw);

  const getDriver = (driverId: string) => drivers.find((d) => d.id === driverId);
  const getBus = (busId: string) => buses.find((b) => b.id === busId);
  const getRoute = (routeId: string) => routes.find((r) => r.id === routeId);
  const getStop = (stopId: string) => stops.find((s) => s.id === stopId);

  const now = Date.now();
  const activeTrips = liveTracking.filter((t) => t.driver_online);
  const driversOnDuty = drivers.filter((d) => d.duty_status === 'on_duty').length;
  const activeBuses = buses.filter((b) => b.current_trip_id != null).length;
  const issues = liveTracking.filter((t) => {
    const secs = (now - t.last_updated) / 1000;
    return secs > 300 || !t.driver_online;
  }).length;

  // Sort: online first, then by last_updated descending
  const sortedTracking = [...liveTracking].sort((a, b) => {
    if (a.driver_online !== b.driver_online) return a.driver_online ? -1 : 1;
    return b.last_updated - a.last_updated;
  });

  const getSegmentStops = (tracking: LiveTracking) => {
    const route = getRoute(tracking.route_id);
    if (!route || !tracking.current_segment_id) return { from: null, to: null };
    const seg = route.segments?.find(
      (s) => `${s.from}-${s.to}` === tracking.current_segment_id
    );
    if (!seg) return { from: null, to: null };
    return {
      from: getStop(seg.from),
      to: getStop(seg.to),
    };
  };

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Active Trips" value={activeTrips.length} icon={Activity} color="bg-[#1976d2]" loading={liveLoading} />
        <StatCard title="Drivers On Duty" value={driversOnDuty} icon={Users} color="bg-[#4caf50]" loading={liveLoading} />
        <StatCard title="Active Buses" value={activeBuses} icon={BusIcon} color="bg-[#9c27b0]" loading={liveLoading} />
        <StatCard title="Issues / Alerts" value={issues} icon={AlertTriangle} color={issues > 0 ? 'bg-[#f44336]' : 'bg-gray-400'} loading={liveLoading} />
      </div>

      {/* Live Trips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live Fleet View
          </h2>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <RefreshCw size={12} className="animate-spin opacity-60" />
            Auto-updating
          </span>
        </div>

        {liveLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedTracking.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <BusIcon size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No buses currently running</p>
              <p className="text-gray-400 text-sm mt-1">Live trip data will appear here when drivers are active</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {sortedTracking.map((tracking) => {
              const driver = getDriver(tracking.driver_id);
              const bus = getBus(tracking.bus_id);
              const route = getRoute(tracking.route_id);
              const { from: segFrom, to: segTo } = getSegmentStops(tracking);
              const secsSinceUpdate = (now - tracking.last_updated) / 1000;
              const isOffline = !tracking.driver_online || secsSinceUpdate > 120;

              return (
                <Card key={tracking.id} className={cn('border transition-all', isOffline ? 'opacity-75 border-red-200' : 'border-gray-200')}>
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-bold text-gray-800">
                          {bus?.registration_number || tracking.bus_id}
                        </p>
                        <p className="text-sm text-gray-500">{driver?.name || 'Unknown Driver'}</p>
                      </div>
                      <TripStatusBadge tracking={tracking} />
                    </div>

                    {/* Route & Direction */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-700 truncate max-w-[160px]">
                        {route?.route_name || 'Unknown Route'}
                      </span>
                      <Badge variant="outline" className={cn('text-xs', tracking.id.includes('UP') ? 'border-blue-300 text-blue-600' : 'border-purple-300 text-purple-600')}>
                        {tracking.id.includes('UP') || Math.random() > 0.5 ? (
                          <><ArrowUp size={10} className="mr-0.5" />UP</>
                        ) : (
                          <><ArrowDown size={10} className="mr-0.5" />DOWN</>
                        )}
                      </Badge>
                    </div>

                    {/* Current segment */}
                    {(segFrom || segTo) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                        <span>
                          Between{' '}
                          <span className="font-medium text-gray-700">{segFrom?.name || '...'}</span>
                          {' '}and{' '}
                          <span className="font-medium text-gray-700">{segTo?.name || '...'}</span>
                        </span>
                      </div>
                    )}

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>Segment progress</span>
                        <span>{Math.round(tracking.segment_progress_percentage || 0)}%</span>
                      </div>
                      <Progress value={tracking.segment_progress_percentage || 0} className="h-1.5" />
                    </div>

                    {/* Speed & GPS */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Gauge size={12} className="text-gray-400" />
                        <span>{Math.round(tracking.location?.speed_kmph || 0)} km/h</span>
                      </div>
                      <div className={cn('flex items-center gap-1', isOffline ? 'text-red-500' : 'text-green-600')}>
                        {isOffline ? <WifiOff size={12} /> : <Wifi size={12} />}
                        <span>{isOffline ? 'Lost' : 'Online'}</span>
                      </div>
                      <div className={cn('flex items-center gap-1', (tracking.location?.accuracy || 0) > 50 ? 'text-orange-500' : 'text-green-600')}>
                        <MapPin size={12} />
                        <span>{Math.round(tracking.location?.accuracy || 0)}m</span>
                      </div>
                    </div>

                    {/* Last updated */}
                    <p className="text-xs text-gray-400">
                      Updated {tracking.last_updated
                        ? formatDistanceToNow(new Date(tracking.last_updated), { addSuffix: true })
                        : 'unknown'}
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-7"
                        onClick={() => setSelectedTrip(tracking)}
                      >
                        <MapPin size={11} className="mr-1" />
                        View on Map
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-7"
                        onClick={() => router.push(`/trips?id=${tracking.id}`)}
                      >
                        <ChevronRight size={11} className="mr-1" />
                        Trip Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Map Modal */}
      {selectedTrip && (
        <BusMapModal
          tracking={selectedTrip}
          bus={getBus(selectedTrip.bus_id) || null}
          driver={getDriver(selectedTrip.driver_id) || null}
          route={getRoute(selectedTrip.route_id) || null}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}
