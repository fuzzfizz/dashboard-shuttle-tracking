import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeFleetStats, filterAdminVehicles } from '../src/lib/admin-utils.ts';
import type { Vehicle, Trip, DailyReportSummary } from '../src/lib/types.ts';

describe('Admin Fleet Overview Utils', () => {
  it('computes fleet stats correctly', () => {
    const vehicles = [
      { id: '1', plate_number: 'AB-123', model: 'Bus', status: 'in_transit', current_route_id: null, created_at: '' },
      { id: '2', plate_number: 'CD-456', model: 'Bus', status: 'idle', current_route_id: null, created_at: '' },
      { id: '3', plate_number: 'EF-789', model: 'Bus', status: 'offline', current_route_id: null, created_at: '' },
    ] as Vehicle[];
    const trips = [
      { id: 't1', vehicle_id: '1', status: 'in_progress', started_at: '', total_distance_km: 0 },
      { id: 't2', vehicle_id: '2', status: 'completed', started_at: '', total_distance_km: 10 },
    ] as Trip[];
    const dailyReports = [
      { vehicle_id: '1', plate_number: 'AB-123', date: '', total_trips: 1, total_distance_km: 15.5, active_duration_hours: 1 },
      { vehicle_id: '2', plate_number: 'CD-456', date: '', total_trips: 2, total_distance_km: 29.7, active_duration_hours: 2 },
    ] as DailyReportSummary[];

    const stats = computeFleetStats(vehicles, trips, dailyReports);
    
    assert.strictEqual(stats.totalVehicles, 3);
    assert.strictEqual(stats.onlineCount, 2);
    assert.strictEqual(stats.inTransitCount, 1);
    assert.strictEqual(stats.totalKmToday, 45.2);
    assert.strictEqual(stats.activeTripsCount, 1);
  });

  it('filters vehicles correctly', () => {
    const vehicles = [
      { id: '1', plate_number: 'AB-123', model: 'Bus', status: 'in_transit', current_route_id: 'r1', created_at: '' },
      { id: '2', plate_number: 'CD-456', model: 'Bus', status: 'idle', current_route_id: 'r2', created_at: '' },
      { id: '3', plate_number: 'EF-789', model: 'Bus', status: 'offline', current_route_id: null, created_at: '' },
    ] as Vehicle[];

    assert.strictEqual(filterAdminVehicles(vehicles, 'AB', 'all').length, 1);
    assert.strictEqual(filterAdminVehicles(vehicles, '', 'idle').length, 1);
    assert.strictEqual(filterAdminVehicles(vehicles, 'r2', 'all').length, 1); // route id match
  });
});
