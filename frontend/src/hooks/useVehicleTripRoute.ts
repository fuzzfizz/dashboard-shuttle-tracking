import { useState, useCallback, useRef, useEffect } from 'react';
import { TripLocation, VehicleTrip, MapPinMode, TripRoundStage } from '../types/trip';
import { calculateTripRoute, clearTripRouteCache } from '../services/tripRouteService';
import { haversineDistanceMeters } from '../services/distanceCalculator';

export interface UseVehicleTripRouteOptions {
  arrivalRadiusMeters?: number;
  dropoffResetDelayMs?: number; // default: 3 * 60 * 1000 (3 minutes)
}

export interface UseVehicleTripRouteResult {
  trips: Record<string, VehicleTrip>;
  actualPaths: Record<string, Array<[number, number]>>;
  roundStages: Record<string, TripRoundStage>;
  pinMode: MapPinMode;
  isCalculating: boolean;
  error: string | null;
  startTrip: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => Promise<VehicleTrip | null>;
  clearTrip: (vehicleId: string) => void;
  recordVehicleBreadcrumb: (vehicleId: string, lat: number, lng: number) => void;
  setPinMode: (mode: MapPinMode) => void;
}

const MIN_BREADCRUMB_DISTANCE_METERS = 5.0;
export const DEFAULT_ARRIVAL_RADIUS_METERS = 80.0;
export const DEFAULT_DROPOFF_RESET_DELAY_MS = 3 * 60 * 1000; // 3 minutes

export function useVehicleTripRoute(options: UseVehicleTripRouteOptions = {}): UseVehicleTripRouteResult {
  const arrivalRadiusMeters = options.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS;
  const dropoffResetDelayMs = options.dropoffResetDelayMs ?? DEFAULT_DROPOFF_RESET_DELAY_MS;

  const [trips, setTrips] = useState<Record<string, VehicleTrip>>({});
  const [actualPaths, setActualPaths] = useState<Record<string, Array<[number, number]>>>({});
  const [roundStages, setRoundStages] = useState<Record<string, TripRoundStage>>({});
  const [pinMode, setPinMode] = useState<MapPinMode>('idle');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const roundStagesRef = useRef<Record<string, TripRoundStage>>({});
  const dropoffTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const tripsRef = useRef<Record<string, VehicleTrip>>({});

  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  useEffect(() => {
    return () => {
      Object.values(dropoffTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const startTrip = useCallback(
    async (vehicleId: string, pickup: TripLocation, dropoff: TripLocation): Promise<VehicleTrip | null> => {
      if (!vehicleId || !pickup || !dropoff) {
        setError('กรุณาระบุข้อมูลจุดรับและจุดส่งให้ครบถ้วน');
        return null;
      }

      setIsCalculating(true);
      setError(null);

      try {
        const trip = await calculateTripRoute(vehicleId, pickup, dropoff);
        setTrips((prev) => ({
          ...prev,
          [vehicleId]: trip,
        }));
        tripsRef.current[vehicleId] = trip;

        // Reset breadcrumbs for this vehicle for the new trip
        setActualPaths((prev) => ({
          ...prev,
          [vehicleId]: [],
        }));
        delete lastCoordsRef.current[vehicleId];

        // Clear any existing dropoff timer
        if (dropoffTimersRef.current[vehicleId]) {
          clearTimeout(dropoffTimersRef.current[vehicleId]);
          delete dropoffTimersRef.current[vehicleId];
        }

        // Check if vehicle has a known location far from pickup
        const lastKnown = lastCoordsRef.current[vehicleId];
        const isFarFromPickup =
          lastKnown &&
          haversineDistanceMeters(lastKnown.lat, lastKnown.lng, pickup.lat, pickup.lng) > arrivalRadiusMeters * 2;

        const initialStage: TripRoundStage = isFarFromPickup ? 'waiting-pickup' : 'in-transit';
        roundStagesRef.current[vehicleId] = initialStage;
        setRoundStages((prev) => ({
          ...prev,
          [vehicleId]: initialStage,
        }));

        return trip;
      } catch (err: any) {
        const msg = err?.message || 'ไม่สามารถคำนวณเส้นทางได้ กรุณาลองใหม่อีกครั้ง';
        setError(msg);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    [arrivalRadiusMeters]
  );

  const clearTrip = useCallback((vehicleId: string) => {
    clearTripRouteCache(vehicleId);
    setTrips((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    delete tripsRef.current[vehicleId];

    setActualPaths((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    delete lastCoordsRef.current[vehicleId];

    setRoundStages((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    delete roundStagesRef.current[vehicleId];

    if (dropoffTimersRef.current[vehicleId]) {
      clearTimeout(dropoffTimersRef.current[vehicleId]);
      delete dropoffTimersRef.current[vehicleId];
    }
  }, []);

  const recordVehicleBreadcrumb = useCallback(
    (vehicleId: string, lat: number, lng: number) => {
      if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
        return;
      }

      const trip = tripsRef.current[vehicleId];

      // Round-based lifecycle when an active trip is configured
      if (trip && trip.pickup && trip.dropoff) {
        const currentStage = roundStagesRef.current[vehicleId] || 'in-transit';
        const distToPickup = haversineDistanceMeters(lat, lng, trip.pickup.lat, trip.pickup.lng);
        const distToDropoff = haversineDistanceMeters(lat, lng, trip.dropoff.lat, trip.dropoff.lng);

        // Stage 1: Waiting to reach pickup before starting round capture
        if (currentStage === 'waiting-pickup') {
          if (distToPickup <= arrivalRadiusMeters) {
            // Reached pickup! Start capturing anew for the new round
            roundStagesRef.current[vehicleId] = 'in-transit';
            setRoundStages((prev) => ({ ...prev, [vehicleId]: 'in-transit' }));

            lastCoordsRef.current[vehicleId] = { lat, lng };
            setActualPaths((prev) => ({
              ...prev,
              [vehicleId]: [[lat, lng]],
            }));
          }
          return; // Do not record deadhead / return journey
        }

        // Stage 2: Vehicle has arrived at dropoff and is in the 3-minute grace period
        if (currentStage === 'arrived-dropoff') {
          return; // Keep existing round breadcrumb frozen
        }

        // Stage 3: In transit from pickup to dropoff
        if (currentStage === 'in-transit') {
          if (distToDropoff <= arrivalRadiusMeters) {
            // Arrived at dropoff!
            roundStagesRef.current[vehicleId] = 'arrived-dropoff';
            setRoundStages((prev) => ({ ...prev, [vehicleId]: 'arrived-dropoff' }));

            // Append final dropoff coordinate to complete the path
            const prevCoord = lastCoordsRef.current[vehicleId];
            const dist = prevCoord ? haversineDistanceMeters(prevCoord.lat, prevCoord.lng, lat, lng) : 999;
            if (dist >= MIN_BREADCRUMB_DISTANCE_METERS) {
              lastCoordsRef.current[vehicleId] = { lat, lng };
              setActualPaths((prev) => {
                const currentList = prev[vehicleId] || [];
                return {
                  ...prev,
                  [vehicleId]: [...currentList, [lat, lng]],
                };
              });
            }

            // Clear previous timer if any
            if (dropoffTimersRef.current[vehicleId]) {
              clearTimeout(dropoffTimersRef.current[vehicleId]);
            }

            // Schedule reset in 3 minutes (or dropoffResetDelayMs)
            dropoffTimersRef.current[vehicleId] = setTimeout(() => {
              // 3 minutes elapsed: reset round breadcrumbs
              setActualPaths((prev) => ({
                ...prev,
                [vehicleId]: [],
              }));
              delete lastCoordsRef.current[vehicleId];

              // Transition to waiting for pickup for the next round
              roundStagesRef.current[vehicleId] = 'waiting-pickup';
              setRoundStages((prev) => ({
                ...prev,
                [vehicleId]: 'waiting-pickup',
              }));
              delete dropoffTimersRef.current[vehicleId];
            }, dropoffResetDelayMs);

            return;
          }

          // While in-transit: apply jitter filter and append
          const prevCoord = lastCoordsRef.current[vehicleId];
          if (prevCoord) {
            const dist = haversineDistanceMeters(prevCoord.lat, prevCoord.lng, lat, lng);
            if (dist < MIN_BREADCRUMB_DISTANCE_METERS) {
              return;
            }
          }

          lastCoordsRef.current[vehicleId] = { lat, lng };
          setActualPaths((prev) => {
            const currentList = prev[vehicleId] || [];
            return {
              ...prev,
              [vehicleId]: [...currentList, [lat, lng]],
            };
          });
          return;
        }
      }

      // Default fallback when no trip is active: standard jitter-filtered breadcrumbs
      const prevCoord = lastCoordsRef.current[vehicleId];
      if (prevCoord) {
        const dist = haversineDistanceMeters(prevCoord.lat, prevCoord.lng, lat, lng);
        if (dist < MIN_BREADCRUMB_DISTANCE_METERS) {
          return;
        }
      }

      lastCoordsRef.current[vehicleId] = { lat, lng };
      setActualPaths((prev) => {
        const currentList = prev[vehicleId] || [];
        return {
          ...prev,
          [vehicleId]: [...currentList, [lat, lng]],
        };
      });
    },
    [arrivalRadiusMeters, dropoffResetDelayMs]
  );

  return {
    trips,
    actualPaths,
    roundStages,
    pinMode,
    isCalculating,
    error,
    startTrip,
    clearTrip,
    recordVehicleBreadcrumb,
    setPinMode,
  };
}
