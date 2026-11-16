import { useState, useCallback, useRef } from 'react';
import { TripLocation, VehicleTrip, MapPinMode } from '../types/trip';
import { calculateTripRoute, clearTripRouteCache } from '../services/tripRouteService';
import { haversineDistanceMeters } from '../services/distanceCalculator';

export interface UseVehicleTripRouteResult {
  trips: Record<string, VehicleTrip>;
  actualPaths: Record<string, Array<[number, number]>>;
  pinMode: MapPinMode;
  isCalculating: boolean;
  error: string | null;
  startTrip: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => Promise<VehicleTrip | null>;
  clearTrip: (vehicleId: string) => void;
  recordVehicleBreadcrumb: (vehicleId: string, lat: number, lng: number) => void;
  setPinMode: (mode: MapPinMode) => void;
}

const MIN_BREADCRUMB_DISTANCE_METERS = 5.0;

export function useVehicleTripRoute(): UseVehicleTripRouteResult {
  const [trips, setTrips] = useState<Record<string, VehicleTrip>>({});
  const [actualPaths, setActualPaths] = useState<Record<string, Array<[number, number]>>>({});
  const [pinMode, setPinMode] = useState<MapPinMode>('idle');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastCoordsRef = useRef<Record<string, { lat: number; lng: number }>>({});

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
        // Reset breadcrumbs for this vehicle for the new trip
        setActualPaths((prev) => ({
          ...prev,
          [vehicleId]: [],
        }));
        delete lastCoordsRef.current[vehicleId];
        return trip;
      } catch (err: any) {
        const msg = err?.message || 'ไม่สามารถคำนวณเส้นทางได้ กรุณาลองใหม่อีกครั้ง';
        setError(msg);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    []
  );

  const clearTrip = useCallback((vehicleId: string) => {
    clearTripRouteCache(vehicleId);
    setTrips((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    setActualPaths((prev) => {
      const next = { ...prev };
      delete next[vehicleId];
      return next;
    });
    delete lastCoordsRef.current[vehicleId];
  }, []);

  const recordVehicleBreadcrumb = useCallback((vehicleId: string, lat: number, lng: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
      return;
    }

    const prevCoord = lastCoordsRef.current[vehicleId];
    if (prevCoord) {
      const dist = haversineDistanceMeters(prevCoord.lat, prevCoord.lng, lat, lng);
      if (dist < MIN_BREADCRUMB_DISTANCE_METERS) {
        return; // Stationary GPS jitter filter
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
  }, []);

  return {
    trips,
    actualPaths,
    pinMode,
    isCalculating,
    error,
    startTrip,
    clearTrip,
    recordVehicleBreadcrumb,
    setPinMode,
  };
}
