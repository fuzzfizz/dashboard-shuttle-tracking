import type { GpsPoint, Trip } from './types.ts';

export function formatDuration(startedAt: string, endedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : new Date().getTime();
  const diffMs = Math.max(0, end - start);
  
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  
  if (hours > 0) {
    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  }
  
  const totalSecs = Math.floor(diffMs / 1000);
  if (totalSecs < 60) {
    return `${totalSecs} sec${totalSecs !== 1 ? 's' : ''}`;
  }
  
  return `${mins} min${mins !== 1 ? 's' : ''}`;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI/180)
}

export function calculateTrackStats(track: GpsPoint[]) {
  if (!track || track.length === 0) {
    return { totalPoints: 0, maxSpeedKmh: 0, avgSpeedKmh: 0, distanceKm: 0 };
  }

  let maxSpeedKmh = 0;
  let sumSpeed = 0;
  let distanceKm = 0;

  for (let i = 0; i < track.length; i++) {
    const pt = track[i];
    if (pt.speed_kmh > maxSpeedKmh) maxSpeedKmh = pt.speed_kmh;
    sumSpeed += pt.speed_kmh;

    if (i > 0) {
      const prev = track[i - 1];
      distanceKm += getDistanceFromLatLonInKm(prev.lat, prev.lng, pt.lat, pt.lng);
    }
  }

  const avgSpeedKmh = sumSpeed / track.length;

  return {
    totalPoints: track.length,
    maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
    avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
    distanceKm: Math.round(distanceKm * 100) / 100,
  };
}

export function filterTrips(trips: Trip[], filters: { date?: string, vehicleId?: string, routeId?: string, status?: string }) {
  return trips.filter(trip => {
    if (filters.date) {
      const tripDate = new Date(trip.started_at).toISOString().split('T')[0];
      if (tripDate !== filters.date) return false;
    }
    if (filters.vehicleId && trip.vehicle_id !== filters.vehicleId) return false;
    if (filters.routeId && trip.route_id !== filters.routeId) return false;
    if (filters.status && filters.status !== 'All' && trip.status !== filters.status) return false;
    return true;
  });
}
