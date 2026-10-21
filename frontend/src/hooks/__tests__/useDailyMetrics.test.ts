import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDailyMetrics } from '../useDailyMetrics';
import { FleetMap } from '../../types/telemetry';
import * as supabaseClientModule from '../../services/supabaseClient';

describe('useDailyMetrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with zero distance and accumulates in-memory when Supabase is unconfigured', () => {
    const initialFleet: FleetMap = {};
    const { result, rerender } = renderHook(({ fleet }) => useDailyMetrics(fleet), {
      initialProps: { fleet: initialFleet },
    });

    expect(result.current.totalFleetDistanceKm).toBe(0);

    // Simulate vehicle movement
    const updatedFleet1: FleetMap = {
      'shuttle-01': {
        vehicle_id: 'shuttle-01',
        lat: 13.7563,
        lng: 100.5018,
        speed: 25.0,
        timestamp: 1000,
      },
    };
    rerender({ fleet: updatedFleet1 });

    // Vehicle moves ~200 meters in 5 seconds
    const updatedFleet2: FleetMap = {
      'shuttle-01': {
        vehicle_id: 'shuttle-01',
        lat: 13.7580,
        lng: 100.5018,
        speed: 30.0,
        timestamp: 6000,
      },
    };
    rerender({ fleet: updatedFleet2 });

    const shuttle01Metric = result.current.dailyMetrics['shuttle-01'];
    expect(shuttle01Metric).toBeDefined();
    expect(shuttle01Metric.total_distance_km).toBeGreaterThan(0.1);
    expect(result.current.totalFleetDistanceKm).toBe(shuttle01Metric.total_distance_km);
  });

  it('accumulates distance for multiple vehicles and calculates fleet total', () => {
    const { result, rerender } = renderHook(({ fleet }) => useDailyMetrics(fleet), {
      initialProps: { fleet: {} as FleetMap },
    });

    // Initial position for 2 shuttles
    rerender({
      fleet: {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 13.7563,
          lng: 100.5018,
          speed: 25.0,
          timestamp: 1000,
        },
        'shuttle-02': {
          vehicle_id: 'shuttle-02',
          lat: 13.7300,
          lng: 100.5200,
          speed: 20.0,
          timestamp: 1000,
        },
      },
    });

    // Movement for both shuttles (both speeds valid < 150 km/h)
    rerender({
      fleet: {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 13.7580,
          lng: 100.5018,
          speed: 30.0,
          timestamp: 6000,
        },
        'shuttle-02': {
          vehicle_id: 'shuttle-02',
          lat: 13.7310,
          lng: 100.5200,
          speed: 22.0,
          timestamp: 6000,
        },
      },
    });

    const m1 = result.current.dailyMetrics['shuttle-01'];
    const m2 = result.current.dailyMetrics['shuttle-02'];
    expect(m1).toBeDefined();
    expect(m2).toBeDefined();

    const expectedSum = Math.round((m1.total_distance_km + m2.total_distance_km) * 100) / 100;
    expect(result.current.totalFleetDistanceKm).toBe(expectedSum);
    expect(m1.max_speed_kmh).toBe(30);
    expect(m2.max_speed_kmh).toBe(22);
  });

  it('filters out parked jitter and GPS teleport spikes', () => {
    const { result, rerender } = renderHook(({ fleet }) => useDailyMetrics(fleet), {
      initialProps: { fleet: {} as FleetMap },
    });

    // Vehicle starts stationary
    rerender({
      fleet: {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 13.7563,
          lng: 100.5018,
          speed: 0.5,
          timestamp: 1000,
        },
      },
    });

    // Parked GPS jitter (< 8m)
    rerender({
      fleet: {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 13.75630005,
          lng: 100.50180005,
          speed: 0.8,
          timestamp: 3000,
        },
      },
    });

    expect(result.current.totalFleetDistanceKm).toBe(0);

    // Impossible teleport jump (implied speed > 150 km/h)
    rerender({
      fleet: {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 14.5000, // ~80 km away in 2 seconds
          lng: 100.5018,
          speed: 40.0,
          timestamp: 5000,
        },
      },
    });

    expect(result.current.totalFleetDistanceKm).toBe(0);
  });

  it('fetches metrics from Supabase when configured and merges with live updates', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true);

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [
          {
            vehicle_id: 'shuttle-01',
            date: new Date().toISOString().split('T')[0],
            total_distance_km: 15.5,
            max_speed_kmh: 55.0,
            avg_speed_kmh: 30.0,
            active_minutes: 40,
            last_updated_at: '2026-10-21T08:00:00Z',
          },
        ],
        error: null,
      }),
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>);

    const { result, rerender } = renderHook(({ fleet }) => useDailyMetrics(fleet), {
      initialProps: { fleet: {} as FleetMap },
    });

    // Wait for async fetch to complete
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockFrom).toHaveBeenCalledWith('daily_vehicle_metrics');
    expect(result.current.dailyMetrics['shuttle-01']).toBeDefined();
    expect(result.current.dailyMetrics['shuttle-01'].total_distance_km).toBe(15.5);
    expect(result.current.totalFleetDistanceKm).toBe(15.5);

    // Initial vehicle telemetry
    rerender({
      fleet: {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 13.7563,
          lng: 100.5018,
          speed: 25.0,
          timestamp: 1000,
        },
      },
    });

    // Vehicle moves ~200 meters
    rerender({
      fleet: {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 13.7580,
          lng: 100.5018,
          speed: 30.0,
          timestamp: 6000,
        },
      },
    });

    const updated = result.current.dailyMetrics['shuttle-01'];
    expect(updated.total_distance_km).toBeGreaterThan(15.5);
    expect(result.current.totalFleetDistanceKm).toBe(updated.total_distance_km);

    // Trigger refetch - distance should not regress to 15.5
    await act(async () => {
      result.current.refetch();
    });

    expect(result.current.dailyMetrics['shuttle-01'].total_distance_km).toBe(updated.total_distance_km);
  });

  it('handles Supabase query error gracefully without throwing', async () => {
    vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('Network error')),
      }),
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof supabaseClientModule.getSupabaseClient>);

    const { result } = renderHook(() => useDailyMetrics({}));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.totalFleetDistanceKm).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
