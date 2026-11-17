import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateTripRoute,
  getCachedTripRoute,
  clearTripRouteCache,
  parseOsrmRouteCoordinates,
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

  it('parses OSRM GeoJSON coordinates [lng, lat] into Leaflet [lat, lng] format correctly', () => {
    const mockOsrmData = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [98.9853, 18.7883],
              [98.9860, 18.7885],
              [98.9875, 18.7892],
              [98.9900, 18.7900],
            ],
          },
          distance: 1450.5,
          duration: 180.2,
        },
      ],
    };

    const coords = parseOsrmRouteCoordinates(mockOsrmData);
    expect(coords).toHaveLength(4);
    expect(coords[0]).toEqual([18.7883, 98.9853]);
    expect(coords[1]).toEqual([18.7885, 98.9860]);
    expect(coords[3]).toEqual([18.7900, 98.9900]);
  });

  it('fetches road-following route from OSRM and formats VehicleTrip on success', async () => {
    const mockOsrmResponse = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [98.9853, 18.7883],
              [98.9865, 18.7888],
              [98.9900, 18.7900],
            ],
          },
          distance: 1200,
          duration: 150,
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockOsrmResponse,
    } as Response);

    const trip = await calculateTripRoute('EV-01', pickup, dropoff);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://router.project-osrm.org/route/v1/driving/98.9853,18.7883;98.99,18.79')
    );
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.plannedPath).toHaveLength(3);
    expect(trip.plannedPath[0]).toEqual([18.7883, 98.9853]);
    expect(trip.plannedPath[2]).toEqual([18.7900, 98.9900]);
    expect(trip.distanceMeters).toBe(1200);
    expect(trip.durationSeconds).toBe(150);
  });

  it('serves cached route without making a network request when called with identical coordinates', async () => {
    const mockOsrmResponse = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [98.9853, 18.7883],
              [98.9900, 18.7900],
            ],
          },
          distance: 850,
          duration: 120,
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockOsrmResponse,
    } as Response);

    // Call 1 -> Network fetch
    const trip1 = await calculateTripRoute('EV-01', pickup, dropoff);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Call 2 -> Cache hit (0 requests)
    const trip2 = await calculateTripRoute('EV-01', pickup, dropoff);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(trip2.plannedPath).toEqual(trip1.plannedPath);

    // Direct cache check
    const cached = getCachedTripRoute('EV-01', pickup, dropoff);
    expect(cached).not.toBeNull();
  });

  it('provides straight geodesic fallback path when network or routing API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const trip = await calculateTripRoute('EV-01', pickup, dropoff);
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.plannedPath).toHaveLength(2);
    expect(trip.plannedPath[0]).toEqual([18.7883, 98.9853]);
    expect(trip.plannedPath[1]).toEqual([18.7900, 98.9900]);
  });

  it('uses Mapbox Directions with alternatives and extracts divergent branches when token is configured', async () => {
    localStorage.setItem('mapbox_access_token', 'pk.testToken');

    const mockMapboxResponse = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [98.9850, 18.7800],
              [98.7850, 18.7850],
              [98.9850, 18.7900],
            ],
          },
          distance: 1100,
          duration: 140,
        },
        {
          geometry: {
            coordinates: [
              [98.9850, 18.7800],
              [98.9950, 18.7850], // Divergent detour
              [98.9850, 18.7900],
            ],
          },
          distance: 1300,
          duration: 170,
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapboxResponse,
    } as Response);

    const trip = await calculateTripRoute('EV-01', pickup, dropoff);

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('api.mapbox.com/directions/v5/mapbox/driving-traffic'));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('alternatives=true'));
    expect(trip.plannedPath).toHaveLength(3);
    expect(trip.alternativePaths).toBeDefined();
    expect(trip.alternativePaths!.length).toBeGreaterThan(0);

    localStorage.removeItem('mapbox_access_token');
  });
});
