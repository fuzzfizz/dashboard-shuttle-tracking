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
  etaTitle: string; // e.g. "เวลาที่เหลือจนถึงจุดส่ง" vs "เวลาที่เหลือจนถึงจุดรับ"
  remainingDistanceLabel: string; // e.g. "เหลืออีก X.XX กม." vs "เหลืออีก X.XX กม. ถึงจุดรับ"
  targetDestinationName: string; // pickup or dropoff name
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
 * Calculates start-to-end total distance, remaining distance to destination (dropoff or pickup),
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

  // 2. Stage: dwelling at dropoff (unloading passengers)
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
      etaTitle: 'สถานะการส่งผู้โดยสาร',
      remainingDistanceLabel: 'จอดส่งผู้โดยสาร (1 นาที)',
      targetDestinationName: trip.dropoff.name || 'จุดส่ง',
    };
  }

  // 3. Stage: arrived at dropoff, waiting 3-min grace period (departing / heading back)
  if (roundStage === 'arrived-dropoff') {
    const distToPickupMeters = currentLocation
      ? haversineDistanceMeters(currentLocation.lat, currentLocation.lng, trip.pickup.lat, trip.pickup.lng)
      : totalDistanceMeters;
    const distToPickupKm = distToPickupMeters / 1000;

    return {
      totalDistanceMeters,
      totalDistanceKm,
      remainingDistanceMeters: 0,
      remainingDistanceKm: 0,
      traveledDistanceKm: totalDistanceKm,
      progressPercent: 100,
      estimatedRemainingSeconds: 0,
      formattedEta: 'ส่งผู้โดยสารเสร็จสิ้นแล้ว',
      etaTitle: 'สถานะการเดินทาง',
      remainingDistanceLabel: `กำลังกลับจุดรับ (เหลือ ${distToPickupKm.toFixed(2)} กม.)`,
      targetDestinationName: trip.dropoff.name || 'จุดส่ง',
    };
  }

  // 4. Stage: waiting to reach pickup (actively returning to pickup for next round)
  if (roundStage === 'waiting-pickup') {
    const distToPickupMeters = currentLocation
      ? haversineDistanceMeters(currentLocation.lat, currentLocation.lng, trip.pickup.lat, trip.pickup.lng)
      : totalDistanceMeters;
    const distToPickupKm = distToPickupMeters / 1000;

    const returnSpeedKmh = currentLocation?.speed && currentLocation.speed >= 15 ? currentLocation.speed : 35;
    const speedMps = (returnSpeedKmh * 1000) / 3600;
    const etaToPickupSeconds = distToPickupMeters <= 80 ? 0 : Math.round(distToPickupMeters / speedMps);

    const etaText = distToPickupMeters <= 80 ? 'ถึงจุดรับแล้ว' : formatRemainingTime(etaToPickupSeconds);
    const returnProgress = Math.min(
      100,
      Math.max(0, Math.round(((totalDistanceMeters - distToPickupMeters) / totalDistanceMeters) * 100))
    );

    return {
      totalDistanceMeters,
      totalDistanceKm,
      remainingDistanceMeters: distToPickupMeters,
      remainingDistanceKm: distToPickupKm,
      traveledDistanceKm: Math.max(0, totalDistanceKm - distToPickupKm),
      progressPercent: returnProgress,
      estimatedRemainingSeconds: etaToPickupSeconds,
      formattedEta: etaText,
      etaTitle: 'เวลาที่เหลือจนถึงจุดรับ',
      remainingDistanceLabel: `เหลืออีก ${distToPickupKm.toFixed(2)} กม. ถึงจุดรับ`,
      targetDestinationName: trip.pickup.name || 'จุดรับ',
    };
  }

  // 5. Stage: in-transit from pickup to dropoff
  if (!currentLocation) {
    const nominalSeconds = trip.durationSeconds || Math.round((totalDistanceKm / 35) * 3600);
    return {
      totalDistanceMeters,
      totalDistanceKm,
      remainingDistanceMeters: totalDistanceMeters,
      remainingDistanceKm: totalDistanceKm,
      traveledDistanceKm: 0,
      progressPercent: 0,
      estimatedRemainingSeconds: nominalSeconds,
      formattedEta: formatRemainingTime(nominalSeconds),
      etaTitle: 'เวลาที่เหลือจนถึงจุดส่ง',
      remainingDistanceLabel: `เหลืออีก ${totalDistanceKm.toFixed(2)} กม.`,
      targetDestinationName: trip.dropoff.name || 'จุดส่ง',
    };
  }

  // Calculate along-route remaining distance using planned path
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

    for (let i = closestIdx; i < trip.plannedPath.length - 1; i++) {
      const [lat1, lng1] = trip.plannedPath[i];
      const [lat2, lng2] = trip.plannedPath[i + 1];
      remainingDistanceMeters += haversineDistanceMeters(lat1, lng1, lat2, lng2);
    }

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
    etaTitle: 'เวลาที่เหลือจนถึงจุดส่ง',
    remainingDistanceLabel: `เหลืออีก ${remainingDistanceKm.toFixed(2)} กม.`,
    targetDestinationName: trip.dropoff.name || 'จุดส่ง',
  };
}
