import { FleetMap } from '../types/telemetry';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export const STORAGE_KEY = 'shuttle_last_known_vehicles';

/**
 * Persists the latest fleet coordinates to localStorage.
 */
export function saveLastKnownVehicles(vehicles: FleetMap): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
  } catch (err) {
    console.warn('Failed to save last known vehicles to localStorage:', err);
  }
}

/**
 * Loads cached fleet coordinates from localStorage.
 */
export function loadLastKnownVehicles(): FleetMap {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as FleetMap;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Fetches the latest telemetry position per vehicle from Supabase telemetry_logs table.
 */
export async function fetchLastKnownTelemetry(): Promise<FleetMap> {
  if (!isSupabaseConfigured()) {
    return {};
  }

  const supabase = getSupabaseClient();
  if (!supabase) return {};

  try {
    const { data, error } = await supabase
      .from('telemetry_logs')
      .select('vehicle_id, lat, lng, speed, heading, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      if (error) console.warn('Supabase fetchLastKnownTelemetry error:', error.message);
      return {};
    }

    const latestFleet: FleetMap = {};
    for (const row of data) {
      const vId = row.vehicle_id;
      if (!vId) continue;

      // Since logs are ordered DESC by recorded_at, the first occurrence is the latest
      if (!latestFleet[vId]) {
        latestFleet[vId] = {
          vehicle_id: vId,
          lat: Number(row.lat),
          lng: Number(row.lng),
          speed: Number(row.speed) || 0,
          heading: Number(row.heading) || 0,
          timestamp: new Date(row.recorded_at).getTime(),
        };
      }
    }

    return latestFleet;
  } catch (err) {
    console.warn('Unexpected error in fetchLastKnownTelemetry:', err);
    return {};
  }
}
