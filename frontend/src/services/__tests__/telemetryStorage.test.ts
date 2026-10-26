import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveLastKnownVehicles,
  loadLastKnownVehicles,
  fetchLastKnownTelemetry,
} from '../telemetryStorage';
import * as supabaseClientModule from '../supabaseClient';
import { FleetMap } from '../../types/telemetry';

describe('telemetryStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveLastKnownVehicles & loadLastKnownVehicles', () => {
    it('returns empty object when localStorage is empty', () => {
      expect(loadLastKnownVehicles()).toEqual({});
    });

    it('saves and reloads fleet map correctly', () => {
      const fleet: FleetMap = {
        'shuttle-01': {
          vehicle_id: 'shuttle-01',
          lat: 18.78397,
          lng: 98.9776,
          speed: 31.4,
          heading: 182.8,
          timestamp: 1700000000000,
        },
      };

      saveLastKnownVehicles(fleet);
      const loaded = loadLastKnownVehicles();
      expect(loaded).toEqual(fleet);
    });

    it('handles corrupted JSON in localStorage gracefully without throwing', () => {
      localStorage.setItem('shuttle_last_known_vehicles', '{invalid json');
      expect(loadLastKnownVehicles()).toEqual({});
    });
  });

  describe('fetchLastKnownTelemetry', () => {
    it('returns empty object when Supabase is not configured', async () => {
      vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(false);
      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(null);

      const result = await fetchLastKnownTelemetry();
      expect(result).toEqual({});
    });

    it('fetches and maps latest telemetry per vehicle from telemetry_logs', async () => {
      vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true);

      const mockLogs = [
        {
          vehicle_id: 'shuttle-cm-01',
          lat: 18.78397,
          lng: 98.977603,
          speed: 31.4,
          heading: 182.8,
          recorded_at: '2026-10-26T09:38:45.744Z',
        },
        {
          vehicle_id: 'shuttle-cm-01', // Older log for same vehicle
          lat: 18.784361,
          lng: 98.977623,
          speed: 32.8,
          heading: 182.8,
          recorded_at: '2026-10-26T09:38:40.737Z',
        },
        {
          vehicle_id: 'shuttle-02',
          lat: 13.7563,
          lng: 100.5018,
          speed: 20.0,
          heading: 90.0,
          recorded_at: '2026-10-26T09:30:00.000Z',
        },
      ];

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetchLastKnownTelemetry();

      expect(mockSupabase.from).toHaveBeenCalledWith('telemetry_logs');
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['shuttle-cm-01']).toEqual({
        vehicle_id: 'shuttle-cm-01',
        lat: 18.78397,
        lng: 98.977603,
        speed: 31.4,
        heading: 182.8,
        timestamp: new Date('2026-10-26T09:38:45.744Z').getTime(),
      });
      expect(result['shuttle-02'].vehicle_id).toBe('shuttle-02');
    });

    it('returns empty object when query fails with error', async () => {
      vi.spyOn(supabaseClientModule, 'isSupabaseConfigured').mockReturnValue(true);

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };

      const mockSupabase = {
        from: vi.fn().mockReturnValue(mockQueryBuilder),
      } as any;

      vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockSupabase);

      const result = await fetchLastKnownTelemetry();
      expect(result).toEqual({});
    });
  });
});
