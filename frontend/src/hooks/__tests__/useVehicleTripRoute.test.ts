import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVehicleTripRoute } from '../useVehicleTripRoute';
import * as tripService from '../../services/tripRouteService';

describe('useVehicleTripRoute', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('initializes with empty trips and idle pin mode', () => {
    const { result } = renderHook(() => useVehicleTripRoute());
    expect(result.current.trips).toEqual({});
    expect(result.current.actualPaths).toEqual({});
    expect(result.current.pinMode).toBe('idle');
    expect(result.current.isCalculating).toBe(false);
  });

  it('starts trip, calls calculateTripRoute once, and stores trip in state', async () => {
    const mockTrip = {
      vehicleId: 'EV-01',
      pickup: { lat: 18.788, lng: 98.985 },
      dropoff: { lat: 18.790, lng: 98.990 },
      plannedPath: [[18.788, 98.985], [18.790, 98.990]] as Array<[number, number]>,
      createdAt: Date.now(),
    };

    const calcSpy = vi.spyOn(tripService, 'calculateTripRoute').mockResolvedValueOnce(mockTrip);

    const { result } = renderHook(() => useVehicleTripRoute());

    await act(async () => {
      await result.current.startTrip('EV-01', mockTrip.pickup, mockTrip.dropoff);
    });

    expect(calcSpy).toHaveBeenCalledTimes(1);
    expect(result.current.trips['EV-01']).toEqual(mockTrip);
    expect(result.current.isCalculating).toBe(false);
  });

  it('appends actual breadcrumbs when vehicle moves more than 5 meters', () => {
    const { result } = renderHook(() => useVehicleTripRoute());

    act(() => {
      // First coordinate
      result.current.recordVehicleBreadcrumb('EV-01', 18.78830, 98.98530);
    });

    expect(result.current.actualPaths['EV-01']).toHaveLength(1);
    expect(result.current.actualPaths['EV-01'][0]).toEqual([18.78830, 98.98530]);

    act(() => {
      // Small jitter (< 1 meter) -> should be filtered out
      result.current.recordVehicleBreadcrumb('EV-01', 18.788301, 98.985301);
    });

    expect(result.current.actualPaths['EV-01']).toHaveLength(1);

    act(() => {
      // Meaningful movement (~15 meters) -> appended
      result.current.recordVehicleBreadcrumb('EV-01', 18.78845, 98.98545);
    });

    expect(result.current.actualPaths['EV-01']).toHaveLength(2);
  });

  it('clears vehicle trip and resets breadcrumb trail when clearTrip is called', async () => {
    const { result } = renderHook(() => useVehicleTripRoute());

    act(() => {
      result.current.recordVehicleBreadcrumb('EV-01', 18.7883, 98.9853);
    });
    expect(result.current.actualPaths['EV-01']).toBeDefined();

    act(() => {
      result.current.clearTrip('EV-01');
    });

    expect(result.current.trips['EV-01']).toBeUndefined();
    expect(result.current.actualPaths['EV-01']).toBeUndefined();
  });

  it('manages round lifecycle: records in-transit, freezes for 3 minutes at dropoff, resets, and restarts at pickup', async () => {
    vi.useFakeTimers();

    const mockTrip = {
      vehicleId: 'shuttle-test-01',
      pickup: { lat: 18.7900, lng: 98.9655 },
      dropoff: { lat: 18.7240, lng: 98.9838 },
      plannedPath: [[18.7900, 98.9655], [18.7240, 98.9838]] as Array<[number, number]>,
      createdAt: Date.now(),
    };

    vi.spyOn(tripService, 'calculateTripRoute').mockResolvedValue(mockTrip);

    const { result } = renderHook(() =>
      useVehicleTripRoute({
        arrivalRadiusMeters: 80,
        dropoffResetDelayMs: 3 * 60 * 1000, // 3 minutes
      })
    );

    // 1. Start Trip
    await act(async () => {
      await result.current.startTrip('shuttle-test-01', mockTrip.pickup, mockTrip.dropoff);
    });

    expect(result.current.roundStages['shuttle-test-01']).toBe('in-transit');
    expect(result.current.actualPaths['shuttle-test-01']).toEqual([]);

    // 2. Vehicle travels along the road (in-transit)
    act(() => {
      result.current.recordVehicleBreadcrumb('shuttle-test-01', 18.7895, 98.9660);
    });
    act(() => {
      result.current.recordVehicleBreadcrumb('shuttle-test-01', 18.7850, 98.9680);
    });

    expect(result.current.actualPaths['shuttle-test-01']).toHaveLength(2);
    expect(result.current.roundStages['shuttle-test-01']).toBe('in-transit');

    // 3. Vehicle reaches dropoff point (within 80m of 18.7240, 98.9838)
    act(() => {
      result.current.recordVehicleBreadcrumb('shuttle-test-01', 18.72401, 98.98381);
    });

    expect(result.current.roundStages['shuttle-test-01']).toBe('arrived-dropoff');
    expect(result.current.actualPaths['shuttle-test-01']).toHaveLength(3); // Completed path intact

    // 4. While within 3 minutes, vehicle moves around / turns back -> breadcrumbs remain frozen, not cleared yet
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes elapsed
      result.current.recordVehicleBreadcrumb('shuttle-test-01', 18.7300, 98.9800);
    });

    expect(result.current.roundStages['shuttle-test-01']).toBe('arrived-dropoff');
    expect(result.current.actualPaths['shuttle-test-01']).toHaveLength(3); // Still 3 points

    // 5. 3 minutes elapsed! Breadcrumbs reset, enters waiting-pickup
    act(() => {
      vi.advanceTimersByTime(1 * 60 * 1000 + 100); // Exceeds 3 minutes total
    });

    expect(result.current.roundStages['shuttle-test-01']).toBe('waiting-pickup');
    expect(result.current.actualPaths['shuttle-test-01']).toEqual([]); // Reset to empty!

    // 6. Driving back on deadhead journey -> no breadcrumbs recorded while waiting for pickup
    act(() => {
      result.current.recordVehicleBreadcrumb('shuttle-test-01', 18.7500, 98.9750);
      result.current.recordVehicleBreadcrumb('shuttle-test-01', 18.7700, 98.9700);
    });

    expect(result.current.roundStages['shuttle-test-01']).toBe('waiting-pickup');
    expect(result.current.actualPaths['shuttle-test-01']).toEqual([]);

    // 7. Arrives at pickup point (within 80m of 18.7900, 98.9655) -> Starts new round!
    act(() => {
      result.current.recordVehicleBreadcrumb('shuttle-test-01', 18.79002, 98.96552);
    });

    expect(result.current.roundStages['shuttle-test-01']).toBe('in-transit');
    expect(result.current.actualPaths['shuttle-test-01']).toHaveLength(1);
    expect(result.current.actualPaths['shuttle-test-01'][0]).toEqual([18.79002, 98.96552]);

    vi.useRealTimers();
  });

  it('restores actualPaths, active trips, and roundStages from localStorage across simulated page refreshes', () => {
    localStorage.setItem(
      'shuttle_active_trips',
      JSON.stringify({
        'shuttle-test-01': {
          vehicleId: 'shuttle-test-01',
          pickup: { lat: 18.79, lng: 98.96 },
          dropoff: { lat: 18.72, lng: 98.98 },
          plannedPath: [[18.79, 98.96], [18.72, 98.98]],
          createdAt: Date.now(),
        },
      })
    );

    localStorage.setItem(
      'shuttle_round_actual_paths',
      JSON.stringify({
        'shuttle-test-01': [
          [18.789, 98.965],
          [18.780, 98.970],
        ],
      })
    );

    localStorage.setItem(
      'shuttle_round_stages',
      JSON.stringify({
        'shuttle-test-01': { stage: 'in-transit' },
      })
    );

    // Render hook simulating newly mounted component on page reload
    const { result } = renderHook(() => useVehicleTripRoute());

    expect(result.current.trips['shuttle-test-01']).toBeDefined();
    expect(result.current.actualPaths['shuttle-test-01']).toHaveLength(2);
    expect(result.current.roundStages['shuttle-test-01']).toBe('in-transit');
  });
});
