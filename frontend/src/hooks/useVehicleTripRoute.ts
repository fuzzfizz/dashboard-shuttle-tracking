import { useState, useCallback, useRef, useEffect } from 'react';
import { TripLocation, VehicleTrip, MapPinMode, TripRoundStage } from '../types/trip';
import { calculateTripRoute, clearTripRouteCache } from '../services/tripRouteService';
import { haversineDistanceMeters } from '../services/distanceCalculator';
import {
  loadActiveTripsFromStorage,
  saveActiveTripsToStorage,
  loadActualPathsFromStorage,
  saveActualPathsToStorage,
  loadRoundStagesFromStorage,
  saveRoundStagesToStorage,
  clearVehicleStoredRound,
} from '../services/tripRouteStorage';

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
const TELEPORT_RESET_DISTANCE_METERS = 500.0;
export const DEFAULT_ARRIVAL_RADIUS_METERS = 80.0;
export const DEFAULT_DROPOFF_RESET_DELAY_MS = 3 * 60 * 1000; // 3 minutes

export function useVehicleTripRoute(options: UseVehicleTripRouteOptions = {}): UseVehicleTripRouteResult {
  const arrivalRadiusMeters = options.arrivalRadiusMeters ?? DEFAULT_ARRIVAL_RADIUS_METERS;
  const dropoffResetDelayMs = options.dropoffResetDelayMs ?? DEFAULT_DROPOFF_RESET_DELAY_MS;

  // Restore persisted trips, breadcrumb paths, and round states across page refreshes
  const [trips, setTrips] = useState<Record<string, VehicleTrip>>(() => loadActiveTripsFromStorage());
  const [actualPaths, setActualPaths] = useState<Record<string, Array<[number, number]>>>(() => {
    const saved = loadActualPathsFromStorage();
    const savedStages = loadRoundStagesFromStorage();
    const initial: Record<string, Array<[number, number]>> = {};
    const now = Date.now();

    for (const [vehicleId, path] of Object.entries(saved)) {
      const stageInfo = savedStages[vehicleId];
      if (stageInfo && stageInfo.stage === 'arrived-dropoff' && stageInfo.arrivedDropoffTime) {
        if (now - stageInfo.arrivedDropoffTime >= dropoffResetDelayMs) {
          // 3 minutes already elapsed while page was closed/refreshed
          initial[vehicleId] = [];
          continue;
        }
      }
      initial[vehicleId] = path;
    }
    return initial;
  });

  const [roundStages, setRoundStages] = useState<Record<string, TripRoundStage>>(() => {
    const savedStages = loadRoundStagesFromStorage();
    const initial: Record<string, TripRoundStage> = {};
    const now = Date.now();

    for (const [vehicleId, info] of Object.entries(savedStages)) {
      if (info.stage === 'arrived-dropoff' && info.arrivedDropoffTime) {
        if (now - info.arrivedDropoffTime >= dropoffResetDelayMs) {
          initial[vehicleId] = 'waiting-pickup';
          continue;
        }
      }
      initial[vehicleId] = info.stage;
    }
    return initial;
  });

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
    roundStagesRef.current = roundStages;
  }, [roundStages]);

  // Restore active 3-minute dropoff timers across page refreshes
  useEffect(() => {
    const savedStages = loadRoundStagesFromStorage();
    const now = Date.now();

    for (const [vehicleId, info] of Object.entries(savedStages)) {
      const countdownStart =
        info.departedDropoffTime || (info.stage === 'arrived-dropoff' ? info.arrivedDropoffTime : undefined);
      if (info.stage === 'arrived-dropoff' && countdownStart) {
        const remaining = dropoffResetDelayMs - (now - countdownStart);
        if (remaining > 0) {
          dropoffTimersRef.current[vehicleId] = setTimeout(() => {
            setActualPaths((prev) => {
              const next: Record<string, [number, number][]> = { ...prev, [vehicleId]: [] };
              saveActualPathsToStorage(next);
              return next;
            });
            delete lastCoordsRef.current[vehicleId];

            roundStagesRef.current[vehicleId] = 'waiting-pickup';
            setRoundStages((prev) => {
              const next = { ...prev, [vehicleId]: 'waiting-pickup' as TripRoundStage };
              saveRoundStagesToStorage({
                ...loadRoundStagesFromStorage(),
                [vehicleId]: { stage: 'waiting-pickup' },
              });
              return next;
            });
            delete dropoffTimersRef.current[vehicleId];
          }, remaining);
        } else {
          // Timer already expired while offline/closed
          setActualPaths((prev) => {
            const next: Record<string, [number, number][]> = { ...prev, [vehicleId]: [] };
            saveActualPathsToStorage(next);
            return next;
          });
          roundStagesRef.current[vehicleId] = 'waiting-pickup';
          setRoundStages((prev) => ({ ...prev, [vehicleId]: 'waiting-pickup' as TripRoundStage }));
          saveRoundStagesToStorage({
            ...loadRoundStagesFromStorage(),
            [vehicleId]: { stage: 'waiting-pickup' },
          });
        }
      }
    }

    return () => {
      Object.values(dropoffTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, [dropoffResetDelayMs]);

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
        setTrips((prev) => {
          const next = { ...prev, [vehicleId]: trip };
          saveActiveTripsToStorage(next);
          return next;
        });
        tripsRef.current[vehicleId] = trip;

        // Reset breadcrumbs for this vehicle for the new trip
        setActualPaths((prev) => {
          const next = { ...prev, [vehicleId]: [] };
          saveActualPathsToStorage(next);
          return next;
        });
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
        setRoundStages((prev) => {
          const next = { ...prev, [vehicleId]: initialStage };
          saveRoundStagesToStorage({
            ...loadRoundStagesFromStorage(),
            [vehicleId]: { stage: initialStage },
          });
          return next;
        });

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
    clearVehicleStoredRound(vehicleId);

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

      const point: [number, number] = [lat, lng];
      const trip = tripsRef.current[vehicleId];

      // Round-based lifecycle when an active trip is configured
      if (trip && trip.pickup && trip.dropoff) {
        const currentStage = roundStagesRef.current[vehicleId] || 'in-transit';
        const distToPickup = haversineDistanceMeters(lat, lng, trip.pickup.lat, trip.pickup.lng);
        const distToDropoff = haversineDistanceMeters(lat, lng, trip.dropoff.lat, trip.dropoff.lng);

        // Check for large position jump (e.g. simulator restarted back at pickup from far away)
        const prevCoord = lastCoordsRef.current[vehicleId];
        if (prevCoord) {
          const jumpDist = haversineDistanceMeters(prevCoord.lat, prevCoord.lng, lat, lng);
          if (jumpDist > TELEPORT_RESET_DISTANCE_METERS && distToPickup <= arrivalRadiusMeters * 2) {
            // Vehicle teleported back to pickup (simulation restart)! Reset round breadcrumbs
            roundStagesRef.current[vehicleId] = 'in-transit';
            setRoundStages((prev) => {
              const next = { ...prev, [vehicleId]: 'in-transit' as TripRoundStage };
              saveRoundStagesToStorage({
                ...loadRoundStagesFromStorage(),
                [vehicleId]: { stage: 'in-transit' },
              });
              return next;
            });

            lastCoordsRef.current[vehicleId] = { lat, lng };
            setActualPaths((prev) => {
              const next: Record<string, [number, number][]> = { ...prev, [vehicleId]: [point] };
              saveActualPathsToStorage(next);
              return next;
            });
            return;
          }
        }

        // Stage 1: Waiting to reach pickup before starting round capture
        if (currentStage === 'waiting-pickup') {
          if (distToPickup <= arrivalRadiusMeters) {
            // Reached pickup! Start capturing anew for the new round
            roundStagesRef.current[vehicleId] = 'in-transit';
            setRoundStages((prev) => {
              const next = { ...prev, [vehicleId]: 'in-transit' as TripRoundStage };
              saveRoundStagesToStorage({
                ...loadRoundStagesFromStorage(),
                [vehicleId]: { stage: 'in-transit' },
              });
              return next;
            });

            lastCoordsRef.current[vehicleId] = { lat, lng };
            setActualPaths((prev) => {
              const next: Record<string, [number, number][]> = { ...prev, [vehicleId]: [point] };
              saveActualPathsToStorage(next);
              return next;
            });
          }
          return; // Do not record deadhead / return journey
        }

        // Stage 2: Vehicle is dwelling at dropoff (unloading passengers)
        if (currentStage === 'dwelling-dropoff') {
          if (distToDropoff > arrivalRadiusMeters) {
            // Passenger drop-off complete! Vehicle has departed dropoff station
            const now = Date.now();
            roundStagesRef.current[vehicleId] = 'arrived-dropoff';
            setRoundStages((prev) => {
              const next = { ...prev, [vehicleId]: 'arrived-dropoff' as TripRoundStage };
              saveRoundStagesToStorage({
                ...loadRoundStagesFromStorage(),
                [vehicleId]: { stage: 'arrived-dropoff', departedDropoffTime: now },
              });
              return next;
            });

            // Start 3-minute countdown now that passenger drop-off is complete
            if (dropoffTimersRef.current[vehicleId]) {
              clearTimeout(dropoffTimersRef.current[vehicleId]);
            }

            dropoffTimersRef.current[vehicleId] = setTimeout(() => {
              // 3 minutes elapsed since departure: reset round breadcrumbs
              setActualPaths((prev) => {
                const next: Record<string, [number, number][]> = { ...prev, [vehicleId]: [] };
                saveActualPathsToStorage(next);
                return next;
              });
              delete lastCoordsRef.current[vehicleId];

              // Transition to waiting for pickup for the next round
              roundStagesRef.current[vehicleId] = 'waiting-pickup';
              setRoundStages((prev) => {
                const next = { ...prev, [vehicleId]: 'waiting-pickup' as TripRoundStage };
                saveRoundStagesToStorage({
                  ...loadRoundStagesFromStorage(),
                  [vehicleId]: { stage: 'waiting-pickup' },
                });
                return next;
              });
              delete dropoffTimersRef.current[vehicleId];
            }, dropoffResetDelayMs);
          }
          return; // Stop drawing: keep existing round breadcrumb frozen while dwelling/departing
        }

        // Stage 3: Vehicle has completed dropoff and is in the 3-minute grace period
        if (currentStage === 'arrived-dropoff') {
          return; // Stop drawing: keep existing round breadcrumb frozen
        }

        // Stage 4: In transit from pickup to dropoff
        if (currentStage === 'in-transit') {
          if (distToDropoff <= arrivalRadiusMeters) {
            // Arrived at dropoff! Enters dwelling stage to unload passengers
            const now = Date.now();
            roundStagesRef.current[vehicleId] = 'dwelling-dropoff';
            setRoundStages((prev) => {
              const next = { ...prev, [vehicleId]: 'dwelling-dropoff' as TripRoundStage };
              saveRoundStagesToStorage({
                ...loadRoundStagesFromStorage(),
                [vehicleId]: { stage: 'dwelling-dropoff', arrivedDropoffTime: now },
              });
              return next;
            });

            // Append final dropoff coordinate to complete the path to the dropoff pin
            const prevCoordAtDropoff = lastCoordsRef.current[vehicleId];
            const dist = prevCoordAtDropoff
              ? haversineDistanceMeters(prevCoordAtDropoff.lat, prevCoordAtDropoff.lng, lat, lng)
              : 999;

            if (dist >= MIN_BREADCRUMB_DISTANCE_METERS) {
              lastCoordsRef.current[vehicleId] = { lat, lng };
              setActualPaths((prev) => {
                const currentList = prev[vehicleId] || [];
                const next: Record<string, [number, number][]> = {
                  ...prev,
                  [vehicleId]: [...currentList, point],
                };
                saveActualPathsToStorage(next);
                return next;
              });
            }

            // Note: 3-minute line removal timer will start ONLY after passenger drop-off is complete (when vehicle departs dropoff)
            return;
          }

          // While in-transit: apply jitter filter and append
          if (prevCoord) {
            const dist = haversineDistanceMeters(prevCoord.lat, prevCoord.lng, lat, lng);
            if (dist < MIN_BREADCRUMB_DISTANCE_METERS) {
              return;
            }
          }

          lastCoordsRef.current[vehicleId] = { lat, lng };
          setActualPaths((prev) => {
            const currentList = prev[vehicleId] || [];
            const next: Record<string, [number, number][]> = {
              ...prev,
              [vehicleId]: [...currentList, point],
            };
            saveActualPathsToStorage(next);
            return next;
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
        const next: Record<string, [number, number][]> = {
          ...prev,
          [vehicleId]: [...currentList, point],
        };
        saveActualPathsToStorage(next);
        return next;
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
