import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useHistoricalTrip } from '../useHistoricalTrip';
import * as supabaseClientModule from '../../services/supabaseClient';

describe('useHistoricalTrip', () => {
  const mockTelemetryData = [
    {
      id: '1',
      vehicle_id: 'shuttle-01',
      lat: 13.736717,
      lng: 100.523186,
      speed: 25.0,
      heading: 90,
      recorded_at: '2026-10-28T02:00:00.000Z',
    },
    {
      id: '2',
      vehicle_id: 'shuttle-01',
      lat: 13.738000,
      lng: 100.525000,
      speed: 30.0,
      heading: 95,
      recorded_at: '2026-10-28T02:01:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches telemetry points and calculates summary successfully', async () => {
    const mockSelectLogs = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTelemetryData, error: null }),
          }),
        }),
      }),
    });

    const mockSelectMetrics = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              total_distance_km: 1.5,
              max_speed_kmh: 30.0,
              avg_speed_kmh: 27.5,
            },
            error: null,
          }),
        }),
      }),
    });

    const mockFrom = vi.fn((table: string) => {
      if (table === 'telemetry_logs') {
        return { select: mockSelectLogs };
      }
      return { select: mockSelectMetrics };
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: mockFrom,
    } as any);

    const { result } = renderHook(() => useHistoricalTrip('shuttle-01', '2026-10-28'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.points).toHaveLength(2);
    expect(result.current.summary.total_distance_km).toBe(1.5);
    expect(result.current.summary.total_points).toBe(2);
  });

  it('handles empty data response gracefully', async () => {
    const mockSelectLogs = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const mockSelectMetrics = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'telemetry_logs') return { select: mockSelectLogs };
        return { select: mockSelectMetrics };
      }),
    } as any);

    const { result } = renderHook(() => useHistoricalTrip('shuttle-01', '2026-10-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.points).toEqual([]);
    expect(result.current.summary.total_points).toBe(0);
    expect(result.current.summary.total_distance_km).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('calculates fallback summary metrics using haversine if daily_vehicle_metrics is missing', async () => {
    const mockSelectLogs = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockTelemetryData, error: null }),
          }),
        }),
      }),
    });

    const mockSelectMetrics = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'telemetry_logs') return { select: mockSelectLogs };
        return { select: mockSelectMetrics };
      }),
    } as any);

    const { result } = renderHook(() => useHistoricalTrip('shuttle-01', '2026-10-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.points).toHaveLength(2);
    expect(result.current.summary.total_points).toBe(2);
    expect(result.current.summary.total_distance_km).toBeGreaterThan(0);
    expect(result.current.summary.max_speed_kmh).toBe(30);
    expect(result.current.summary.avg_speed_kmh).toBe(27.5);
    expect(result.current.summary.start_time).toBe('2026-10-28T02:00:00.000Z');
    expect(result.current.summary.end_time).toBe('2026-10-28T02:01:00.000Z');
  });

  it('handles query error from Supabase', async () => {
    const mockSelectLogs = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database connection failed' } }),
          }),
        }),
      }),
    });

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue({
      from: vi.fn(() => ({ select: mockSelectLogs })),
    } as any);

    const { result } = renderHook(() => useHistoricalTrip('shuttle-01', '2026-10-28'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Database connection failed');
    expect(result.current.points).toEqual([]);
  });

  it('handles null client or empty parameters gracefully', async () => {
    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(null);

    const { result } = renderHook(() => useHistoricalTrip('', ''));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.points).toEqual([]);
    expect(result.current.summary.total_points).toBe(0);
    expect(result.current.error).toBeNull();
  });
});
