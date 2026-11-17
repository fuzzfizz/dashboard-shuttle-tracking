import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateMapboxTripRoute,
  calculateMapboxTripRouteDetailed,
  parseMapboxRouteCoordinates,
  distanceToSegmentMeters,
  getDivergentSegments,
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
      expect.stringContaining(`${MAPBOX_DIRECTIONS_API_BASE}/driving/98.9853,18.7883;98.99,18.79`)
    );
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('access_token=pk.mockToken123'));
    expect(trip.vehicleId).toBe('EV-01');
    expect(trip.distanceMeters).toBe(1200);
    expect(trip.durationSeconds).toBe(160);
    expect(trip.plannedPath).toHaveLength(2);
  });

  it('supports custom options including driving-traffic, alternatives, and exclusions', async () => {
    const mockDetailedResponse = {
      code: 'Ok',
      routes: [
        {
          geometry: {
            coordinates: [
              [98.9853, 18.7883],
              [98.9900, 18.7900],
            ],
          },
          distance: 1250,
          duration: 190,
        },
        {
          geometry: {
            coordinates: [
              [98.9853, 18.7883],
              [98.9880, 18.7895],
              [98.9900, 18.7900],
            ],
          },
          distance: 1400,
          duration: 220,
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockDetailedResponse,
    } as Response);

    const result = await calculateMapboxTripRouteDetailed('EV-HYBRID', pickup, dropoff, 'pk.validKey', {
      profile: 'driving-traffic',
      alternatives: true,
      excludeToll: true,
      excludeMotorway: true,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/mapbox/driving-traffic/98.9853,18.7883;98.99,18.79')
    );
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('alternatives=true'));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('exclude=toll,motorway'));

    expect(result.primaryTrip.distanceMeters).toBe(1250);
    expect(result.primaryTrip.durationSeconds).toBe(190);
    expect(result.alternativeTrips).toHaveLength(1);
    expect(result.alternativeTrips[0].distanceMeters).toBe(1400);
    expect(result.alternativeTrips[0].durationSeconds).toBe(220);
    expect(result.alternativeTrips[0].plannedPath).toHaveLength(3);
  });

  describe('getDivergentSegments (hiding overlapping route sections)', () => {
    it('accurately calculates distance from a point to a segment in meters', () => {
      // Point (18.7883, 98.9853) on segment between (18.7880, 98.9853) and (18.7890, 98.9853)
      const distOnLine = distanceToSegmentMeters(18.7883, 98.9853, 18.7880, 98.9853, 18.7890, 98.9853);
      expect(distOnLine).toBeCloseTo(0, 1);

      // Point slightly offset by ~0.001 deg (~110 meters)
      const distOffset = distanceToSegmentMeters(18.7883, 98.9863, 18.7880, 98.9853, 18.7890, 98.9853);
      expect(distOffset).toBeGreaterThan(50);
    });

    it('extracts only the divergent branch and eliminates overlapping start and end segments', () => {
      // Primary: goes straight south to north along lng = 98.9850
      const primary: Array<[number, number]> = [
        [18.7800, 98.9850],
        [18.7820, 98.9850],
        [18.7850, 98.9850],
        [18.7880, 98.9850],
        [18.7900, 98.9850],
      ];

      // Alternative: starts on same road, takes a detour east at 18.7820, rejoins at 18.7880, ends on same road
      const alternative: Array<[number, number]> = [
        [18.7800, 98.9850], // Shared start
        [18.7820, 98.9850], // Branch point
        [18.7840, 98.9900], // Detour point 1
        [18.7860, 98.9900], // Detour point 2
        [18.7880, 98.9850], // Rejoin point
        [18.7900, 98.9850], // Shared end
      ];

      const branches = getDivergentSegments(alternative, primary, 15);

      // Should only contain 1 continuous divergent polyline starting at branch point and ending at rejoin point
      expect(branches).toHaveLength(1);
      const branch = branches[0];
      expect(branch).toHaveLength(4);
      expect(branch[0]).toEqual([18.7820, 98.9850]); // Branch point
      expect(branch[1]).toEqual([18.7840, 98.9900]);
      expect(branch[2]).toEqual([18.7860, 98.9900]);
      expect(branch[3]).toEqual([18.7880, 98.9850]); // Rejoin point
    });

    it('returns empty array if alternative route is completely identical / overlapping with primary', () => {
      const primary: Array<[number, number]> = [
        [18.7800, 98.9850],
        [18.7850, 98.9850],
        [18.7900, 98.9850],
      ];
      const alternative: Array<[number, number]> = [
        [18.7800, 98.9850],
        [18.7850, 98.9850],
        [18.7900, 98.9850],
      ];

      const branches = getDivergentSegments(alternative, primary, 15);
      expect(branches).toHaveLength(0);
    });
  });
});
