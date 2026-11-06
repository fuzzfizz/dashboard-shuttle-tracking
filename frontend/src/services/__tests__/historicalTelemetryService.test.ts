import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetch7DayVehicleMetrics,
  fetchTodayHourlyDistanceMap,
} from '../historicalTelemetryService';
import * as supabaseClientModule from '../supabaseClient';

describe('historicalTelemetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetch7DayVehicleMetrics', () => {
    it('returns empty array when Supabase is not configured', async () => {
      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(null);

      const result = await fetch7DayVehicleMetrics();
      expect(result).toEqual([]);
    });

    it('returns empty array when query returns error', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetch7DayVehicleMetrics();
      expect(result).toEqual([]);
    });

    it('handles unexpected exceptions gracefully and returns empty array', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Network crash');
        }),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetch7DayVehicleMetrics();
      expect(result).toEqual([]);
    });


    it('queries daily_vehicle_metrics for 7 days in Bangkok timezone and returns mapped records', async () => {
      const mockData = [
        { vehicle_id: 'shuttle-01', date: '2026-10-31', total_distance_km: 12.5 },
        { vehicle_id: 'shuttle-02', date: '2026-10-31', total_distance_km: 15.0 },
        { vehicle_id: 'shuttle-01', date: '2026-11-06', total_distance_km: 18.2 },
      ];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      // Reference date: 2026-11-06 at 15:00 Bangkok time (UTC 08:00)
      const refDate = new Date('2026-11-06T08:00:00.000Z');
      const result = await fetch7DayVehicleMetrics(refDate);

      expect(mockSupabase.from).toHaveBeenCalledWith('daily_vehicle_metrics');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('vehicle_id, date, total_distance_km');
      // 7-day range ending on 2026-11-06 starts on 2026-10-31
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('date', '2026-10-31');
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('date', '2026-11-06');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('date', { ascending: true });

      expect(result).toEqual([
        { vehicle_id: 'shuttle-01', date: '2026-10-31', total_distance_km: 12.5 },
        { vehicle_id: 'shuttle-02', date: '2026-10-31', total_distance_km: 15.0 },
        { vehicle_id: 'shuttle-01', date: '2026-11-06', total_distance_km: 18.2 },
      ]);
    });
  });

  describe('fetchTodayHourlyDistanceMap', () => {
    it('returns empty object when Supabase is not configured or dateStr is empty', async () => {
      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(null);
      const res1 = await fetchTodayHourlyDistanceMap('2026-10-28');
      expect(res1).toEqual({});

      const mockSupabase = { from: vi.fn() } as any;
      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);
      const res2 = await fetchTodayHourlyDistanceMap('');
      expect(res2).toEqual({});
    });

    it('returns empty object when query returns error or empty logs', async () => {
      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetchTodayHourlyDistanceMap('2026-10-28');
      expect(result).toEqual({});
    });

    it('handles unexpected exceptions in fetchTodayHourlyDistanceMap gracefully', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Fatal socket closed');
        }),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetchTodayHourlyDistanceMap('2026-10-28');
      expect(result).toEqual({});
    });

    it('handles vehicle with single point gracefully with empty hours map', async () => {
      const mockLogs = [
        {
          vehicle_id: 'shuttle-01',
          lat: 13.736717,
          lng: 100.523186,
          recorded_at: '2026-10-28T01:00:00.000Z',
        },
      ];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetchTodayHourlyDistanceMap('2026-10-28');
      expect(result).toEqual({ 'shuttle-01': {} });
    });


    it('queries telemetry_logs for Bangkok day and calculates incremental distances per vehicle per Bangkok hour', async () => {
      // 2026-10-28 Bangkok day:
      // Start: 2026-10-27T17:00:00.000Z
      // End: 2026-10-28T16:59:59.999Z
      // 08:00 Bangkok = 01:00 UTC
      // 08:05 Bangkok = 01:05 UTC
      // 09:10 Bangkok = 02:10 UTC
      // 09:15 Bangkok = 02:15 UTC
      const mockLogs = [
        // Shuttle 1 points
        {
          vehicle_id: 'shuttle-01',
          lat: 13.736717,
          lng: 100.523186,
          recorded_at: '2026-10-28T01:00:00.000Z', // 08:00 Bangkok (hour 8)
        },
        {
          vehicle_id: 'shuttle-01',
          lat: 13.746717,
          lng: 100.523186,
          recorded_at: '2026-10-28T01:05:00.000Z', // 08:05 Bangkok (hour 8)
        },
        {
          vehicle_id: 'shuttle-01',
          lat: 13.756717,
          lng: 100.523186,
          recorded_at: '2026-10-28T02:10:00.000Z', // 09:10 Bangkok (hour 9)
        },
        // Shuttle 2 points interleaved
        {
          vehicle_id: 'shuttle-02',
          lat: 13.750000,
          lng: 100.500000,
          recorded_at: '2026-10-28T01:02:00.000Z', // 08:02 Bangkok (hour 8)
        },
        {
          vehicle_id: 'shuttle-02',
          lat: 13.760000,
          lng: 100.500000,
          recorded_at: '2026-10-28T01:10:00.000Z', // 08:10 Bangkok (hour 8)
        },
      ];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetchTodayHourlyDistanceMap('2026-10-28');

      expect(mockSupabase.from).toHaveBeenCalledWith('telemetry_logs');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('recorded_at', '2026-10-27T17:00:00.000Z');
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('recorded_at', '2026-10-28T16:59:59.999Z');

      // Check that shuttle-01 has distances for hour 8 and hour 9
      expect(result['shuttle-01']).toBeDefined();
      expect(result['shuttle-01'][8]).toBeGreaterThan(1.0);
      expect(result['shuttle-01'][9]).toBeGreaterThan(1.0);

      // Check that shuttle-02 has distance for hour 8
      expect(result['shuttle-02']).toBeDefined();
      expect(result['shuttle-02'][8]).toBeGreaterThan(1.0);
      expect(result['shuttle-02'][9]).toBeUndefined();
    });
  });
});
