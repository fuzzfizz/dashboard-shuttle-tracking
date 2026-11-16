import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateTripRoute,
  getCachedTripRoute,
  clearTripRouteCache,
  parseLongdoGuideCoordinates,
} from '../tripRouteService';
import { TripLocation } from '../../types/trip';

describe('tripRouteService', () => {
  const pickup: TripLocation = { lat: 18.7883, lng: 98.9853, name: 'Faculty of Pharmacy' };
  const dropoff: TripLocation = { lat: 18.7900, lng: 98.9900, name: 'Maharaj Hospital' };

  beforeEach(() => {
    clearTripRouteCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearTripRouteCache();
  });

  it('parses coordinate pairs from Longdo Route guide data correctly', () => {
    const mockGuideData = {
      data: [
        { latitude: 18.7883, longitude: 98.9853 },
        { latitude: 18.7890, longitude: 98.9870 },
        { latitude: 18.7900, longitude: 98.9900 },
      ],
      distance: 1250,
      interval: 180,
    };

    const coords = parseLongdoGuideCoordinates(mockGuideData);
    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual([18.7883, 98.9853]);
    expect(coords[2]).toEqual([18.7900, 98.9900]);
  });

  it('fetches route from Longdo Route REST API and formats VehicleTrip on success', async () => {
    const mockResponse = {
      data: [
        { latitude: 18.7883, longitude: 98.9853 },
        { latitude: 18.7900, longitude: 98.9900 },
      ],
      distance: 850,
      interval: 120,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const trip = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://api.longdo.com/RouteService/json/route/guide?')
    );
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.plannedPath).toHaveLength(2);
    expect(trip.distanceMeters).toBe(850);
    expect(trip.durationSeconds).toBe(120);
  });

  it('serves cached route without making a network request when called with identical coordinates', async () => {
    const mockResponse = {
      data: [
        { latitude: 18.7883, longitude: 98.9853 },
        { latitude: 18.7900, longitude: 98.9900 },
      ],
      distance: 850,
      interval: 120,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    // Call 1 -> Network fetch
    const trip1 = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Call 2 -> Cache hit (0 requests)
    const trip2 = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(trip2.plannedPath).toEqual(trip1.plannedPath);

    // Direct cache check
    const cached = getCachedTripRoute('EV-01', pickup, dropoff);
    expect(cached).not.toBeNull();
  });

  it('provides straight geodesic fallback path when network or API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const trip = await calculateTripRoute('EV-01', pickup, dropoff, 'mock-key');
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.plannedPath).toEqual([
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng],
    ]);
  });
});
