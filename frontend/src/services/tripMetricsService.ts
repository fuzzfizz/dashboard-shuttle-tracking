import { VehicleTrip, TripRoundStage } from '../types/trip';
import { haversineDistanceMeters } from './distanceCalculator';

export interface TripProgressMetrics {
  totalDistanceMeters: number;
  totalDistanceKm: number;
  remainingDistanceMeters: number;
  remainingDistanceKm: number;
  traveledDistanceKm: number;
  progressPercent: number; // 0 - 100
  estimatedRemainingSeconds: number;
  formattedEta: string; // e.g. "~8 นาที", "< 1 นาที", "ถึงจุดส่งแล้ว"
}

/**
 * Formats estimated remaining seconds into human-friendly Thai text.
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) {
    return 'ถึงจุดส่งแล้ว';
  }
  if (seconds < 60) {
    return '< 1 นาที';
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `~${minutes} นาที`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) {
    return `~${hours} ชม.`;
  }
  return `~${hours} ชม. ${remMinutes} นาที`;
}

/**
 * Calculates start-to-end total distance, remaining distance to dropoff,
 * progress percentage, and estimated remaining time (ETA).
 */
export function calculateTripProgressMetrics(
  trip?: VehicleTrip,
  currentLocation?: { lat: number; lng: number; speed?: number } | null,
  roundStage?: TripRoundStage
): TripProgressMetrics | null {
  if (!trip || !trip.pickup || !trip.dropoff) {
    return null;
  }

  // 1. Calculate total planned route distance
  let totalDistanceMeters = trip.distanceMeters || 0;
  if (!totalDistanceMeters && trip.plannedPath && trip.plannedPath.length >= 2) {
    for (let i = 0; i < trip.plannedPath.length - 1; i++) {
      const [lat1, lng1] = trip.plannedPath[i];
      const [lat2, lng2] = trip.plannedPath[i + 1];
      totalDistanceMeters += haversineDistanceMeters(lat1, lng1, lat2, lng2);
    }
  }
  if (!totalDistanceMeters) {
    totalDistanceMeters = haversineDistanceMeters(
      trip.pickup.lat,
      trip.pickup.lng,
      trip.dropoff.lat,
      trip.dropoff.lng
    );
  }

  const totalDistanceKm = totalDistanceMeters / 1000;

  // 2. Handle non-transit round stages
  if (roundStage === 'dwelling-dropoff') {
    return {
      totalDistanceMeters,
      totalDistanceKm,
      remainingDistanceMeters: 0,
      remainingDistanceKm: 0,
      traveledDistanceKm: totalDistanceKm,
      progressPercent: 100,
      estimatedRemainingSeconds: 0,
      formattedEta: 'ถึงจุดส่งแล้ว (กำลังส่งคนลง)',
    };
  }

  if (roundStage === 'arrived-dropoff') {
    return {
      totalDistanceMeters,
      totalDistanceKm,
      remainingDistanceMeters: 0,
      remainingDistanceKm: 0,
      traveledDistanceKm: totalDistanceKm,
      progressPercent: 100,
      estimatedRemainingSeconds: 0,
      formattedEta: 'ส่งผู้โดยสารเสร็จสิ้นแล้ว',
    };
  }

  if (roundStage === 'waiting-pickup') {
    return {
      totalDistanceMeters,
      totalDistanceKm,
      remainingDistanceMeters: 0,
      remainingDistanceKm: 0,
      traveledDistanceKm: totalDistanceKm,
      progressPercent: 0,
      estimatedRemainingSeconds: 0,
      formattedEta: 'รอเริ่มรอบใหม่ที่จุดรับ',
    };
  }

  // 3. Stage is in-transit (or initial trip before movement)
  if (!currentLocation) {
    const nominalSeconds =
      trip.durationSeconds || Math.round((totalDistanceKm / 35) * 3600);
    return {
      totalDistanceMeters,
      totalDistanceKm,
      remainingDistanceMeters: totalDistanceMeters,
      remainingDistanceKm: totalDistanceKm,
      traveledDistanceKm: 0,
      progressPercent: 0,
      estimatedRemainingSeconds: nominalSeconds,
      formattedEta: formatRemainingTime(nominalSeconds),
    };
  }

  // 4. Calculate along-route remaining distance using planned path
  let remainingDistanceMeters = 0;
  const distToDropoff = haversineDistanceMeters(
    currentLocation.lat,
    currentLocation.lng,
    trip.dropoff.lat,
    trip.dropoff.lng
  );

  if (distToDropoff <= 80) {
    remainingDistanceMeters = 0;
  } else if (trip.plannedPath && trip.plannedPath.length >= 2) {
    let closestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < trip.plannedPath.length; i++) {
      const [pLat, pLng] = trip.plannedPath[i];
      const d = haversineDistanceMeters(currentLocation.lat, currentLocation.lng, pLat, pLng);
      if (d < minDistance) {
        minDistance = d;
        closestIdx = i;
      }
    }

    // Sum path distance from closest point to destination
    for (let i = closestIdx; i < trip.plannedPath.length - 1; i++) {
      const [lat1, lng1] = trip.plannedPath[i];
      const [lat2, lng2] = trip.plannedPath[i + 1];
      remainingDistanceMeters += haversineDistanceMeters(lat1, lng1, lat2, lng2);
    }

    // Clamp between direct line and total distance
    remainingDistanceMeters = Math.min(
      totalDistanceMeters,
      Math.max(distToDropoff, remainingDistanceMeters)
    );
  } else {
    remainingDistanceMeters = distToDropoff;
  }

  const remainingDistanceKm = remainingDistanceMeters / 1000;
  const traveledDistanceKm = Math.max(0, totalDistanceKm - remainingDistanceKm);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((traveledDistanceKm / totalDistanceKm) * 100))
  );

  // 5. Calculate ETA based on nominal duration and vehicle speed
  const nominalSpeedMps =
    trip.durationSeconds && trip.durationSeconds > 0
      ? totalDistanceMeters / trip.durationSeconds
      : (35 * 1000) / 3600;

  const currentSpeedKmh = currentLocation.speed ?? 0;
  let effectiveSpeedMps = nominalSpeedMps;

  if (currentSpeedKmh >= 15) {
    const liveSpeedMps = (currentSpeedKmh * 1000) / 3600;
    effectiveSpeedMps = nominalSpeedMps * 0.6 + liveSpeedMps * 0.4;
  }

  const estimatedRemainingSeconds =
    remainingDistanceMeters <= 50 ? 0 : Math.round(remainingDistanceMeters / effectiveSpeedMps);

  const formattedEta = formatRemainingTime(estimatedRemainingSeconds);

  return {
    totalDistanceMeters,
    totalDistanceKm,
    remainingDistanceMeters,
    remainingDistanceKm,
    traveledDistanceKm,
    progressPercent,
    estimatedRemainingSeconds,
    formattedEta,
  };
}
