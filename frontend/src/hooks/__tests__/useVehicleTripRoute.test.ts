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
});
