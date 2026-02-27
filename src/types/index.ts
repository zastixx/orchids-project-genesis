export interface User {
  id: string;
  name: string;
  phone: string;
  role: 'driver' | 'admin';
  fcm_token?: string;
  language_preference?: 'hi' | 'en';
}

export interface Driver {
  id: string;
  user_id: string;
  employee_id: string;
  name: string;
  phone: string;
  assigned_bus_id?: string;
  assigned_route_id?: string;
  current_trip_id?: string | null;
  duty_status: 'on_duty' | 'off_duty' | 'on_break';
  total_trips_completed: number;
  license_number: string;
  license_expiry: string; // YYYY-MM-DD
}

export interface Bus {
  id: string;
  registration_number: string;
  operator: string;
  bus_type: 'ordinary' | 'express' | 'AC';
  total_seats: number;
  assigned_route_id?: string;
  current_trip_id?: string | null;
  status: 'active' | 'maintenance';
}

export interface RouteSegment {
  from: string;
  to: string;
  distance_km: number;
  avg_duration_min: number;
}

export interface Route {
  id: string;
  route_name: string;
  route_type: 'shuttle' | 'express' | 'limited';
  certain_stops_up: string[];
  certain_stops_down: string[];
  segments: RouteSegment[];
  typical_daily_trips: number;
  first_departure: string; // HH:MM
  last_departure: string; // HH:MM
}

export interface Stop {
  id: string;
  name: string;
  local_name: string;
  latitude: number;
  longitude: number;
  type: 'terminal' | 'junction' | 'conditional' | 'district';
  district: string;
  geofence_radius?: number;
}

export interface Trip {
  id: string;
  trip_id: string;
  route_id: string;
  bus_id: string;
  driver_id: string;
  direction: 'UP' | 'DOWN';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_departure: number;
  actual_departure?: number | null;
  actual_arrival?: number | null;
  current_segment_id?: string;
  delay_minutes: number;
}

export interface LiveLocation {
  latitude: number;
  longitude: number;
  speed_kmph: number;
  bearing: number;
  accuracy: number;
  timestamp: number;
}

export interface LiveTracking {
  id: string; // tripId
  bus_id: string;
  driver_id: string;
  route_id: string;
  location: LiveLocation;
  current_segment_id: string;
  segment_progress_percentage: number;
  next_certain_stop_id: string;
  estimated_minutes_to_next_stop: number;
  last_updated: number;
  driver_online: boolean;
}

export interface SystemConfig {
  announcement_banner?: string;
  maintenance_mode?: boolean;
  tracking_interval?: number;
  geofence_radius_default?: number;
  max_eta_display?: number;
  sos_helpline?: string;
}
