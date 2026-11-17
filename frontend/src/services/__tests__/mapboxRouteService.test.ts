import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateMapboxTripRoute,
  parseMapboxRouteCoordinates,
  MAPBOX_DIRECTIONS_API_BASE,
} from '../mapboxRouteService';
import { TripLocation } from '../../types/trip';

describe('mapboxRouteService', () => {
  const pickup: TripLocation = { lat: 18.7883, lng: 98.9853, name: 'Faculty of Pharmacy' };
  const dropoff: TripLocation = { lat: 18.7900, lng: 98.9900, name: 'Maharaj Hospital' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses GeoJSON coordinates from Mapbox into Leaflet [lat, lng] format', () => {
    const mockMapboxJson = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [98.9853, 18.7883],
              [98.9870, 18.7890],
              [98.9900, 18.7900],
            ],
          },
          distance: 1350.4,
          duration: 175.2,
        },
      ],
    };

    const coords = parseMapboxRouteCoordinates(mockMapboxJson);
    expect(coords).toHaveLength(3);
    expect(coords[0]).toEqual([18.7883, 98.9853]);
    expect(coords[1]).toEqual([18.7890, 98.9870]);
    expect(coords[2]).toEqual([18.7900, 98.9900]);
  });

  it('throws an error if Mapbox Access Token is missing', async () => {
    await expect(calculateMapboxTripRoute('EV-01', pickup, dropoff, '')).rejects.toThrow(
      /Mapbox Access Token is required/i
    );
  });

  it('calls Mapbox Directions API with token and formats VehicleTrip correctly', async () => {
    const mockMapboxResponse = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [98.9853, 18.7883],
              [98.9900, 18.7900],
            ],
          },
          distance: 1200,
          duration: 160,
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockMapboxResponse,
    } as Response);

    const trip = await calculateMapboxTripRoute('EV-01', pickup, dropoff, 'pk.mockToken123');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(`${MAPBOX_DIRECTIONS_API_BASE}/98.9853,18.7883;98.99,18.79`)
    );
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('access_token=pk.mockToken123'));
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.distanceMeters).toBe(1200);
    expect(trip.durationSeconds).toBe(160);
    expect(trip.plannedPath).toHaveLength(2);
  });
});
