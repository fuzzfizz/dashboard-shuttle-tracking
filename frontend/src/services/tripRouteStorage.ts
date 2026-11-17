import { VehicleTrip, TripRoundStage } from '../types/trip';

export const TRIPS_STORAGE_KEY = 'shuttle_active_trips';
export const ACTUAL_PATHS_STORAGE_KEY = 'shuttle_round_actual_paths';
export const ROUND_STAGES_STORAGE_KEY = 'shuttle_round_stages';

export interface SavedRoundStageInfo {
  stage: TripRoundStage;
  arrivedDropoffTime?: number;
  departedDropoffTime?: number;
}

/**
 * Persists active trip configurations to localStorage.
 */
export function saveActiveTripsToStorage(trips: Record<string, VehicleTrip>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Loads active trip configurations from localStorage.
 */
export function loadActiveTripsFromStorage(): Record<string, VehicleTrip> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(TRIPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persists current round actual breadcrumb paths to localStorage.
 */
export function saveActualPathsToStorage(paths: Record<string, Array<[number, number]>>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACTUAL_PATHS_STORAGE_KEY, JSON.stringify(paths));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Loads current round actual breadcrumb paths from localStorage.
 */
export function loadActualPathsFromStorage(): Record<string, Array<[number, number]>> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(ACTUAL_PATHS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Persists round stages and dropoff arrival timestamps to localStorage.
 */
export function saveRoundStagesToStorage(stages: Record<string, SavedRoundStageInfo>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ROUND_STAGES_STORAGE_KEY, JSON.stringify(stages));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Loads round stages and dropoff arrival timestamps from localStorage.
 */
export function loadRoundStagesFromStorage(): Record<string, SavedRoundStageInfo> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(ROUND_STAGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Clears stored round state for a specific vehicle.
 */
export function clearVehicleStoredRound(vehicleId: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const trips = loadActiveTripsFromStorage();
    delete trips[vehicleId];
    saveActiveTripsToStorage(trips);

    const paths = loadActualPathsFromStorage();
    delete paths[vehicleId];
    saveActualPathsToStorage(paths);

    const stages = loadRoundStagesFromStorage();
    delete stages[vehicleId];
    saveRoundStagesToStorage(stages);
  } catch {
    // Ignore
  }
}
