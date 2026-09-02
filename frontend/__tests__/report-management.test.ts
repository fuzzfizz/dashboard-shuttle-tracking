import { test, describe } from 'node:test';
import assert from 'node:assert';
import { 
  calculateReportTotals, 
  generateCsvContent, 
  getDatePresetRange 
} from '../src/lib/report-utils.ts';

describe('report-utils', () => {
  describe('calculateReportTotals', () => {
    test('calculates totals correctly with sample reports', () => {
      const reports = [
        {
          date: '2023-10-01',
          vehicle_id: 'v1',
          plate_number: 'ABC-123',
          total_trips: 2,
          total_distance_km: 10,
          active_duration_hours: 2
        },
        {
          date: '2023-10-01',
          vehicle_id: 'v2',
          plate_number: 'XYZ-987',
          total_trips: 3,
          total_distance_km: 20,
          active_duration_hours: 4
        }
      ];

      const result = calculateReportTotals(reports);
      assert.strictEqual(result.totalDistanceKm, 30);
      assert.strictEqual(result.totalTrips, 5);
      assert.strictEqual(result.totalActiveHours, 6);
      assert.strictEqual(result.avgDistancePerTrip, 6); // 30 / 5
      assert.strictEqual(result.activeVehiclesCount, 2);
    });

    test('handles empty reports array', () => {
      const result = calculateReportTotals([]);
      assert.strictEqual(result.totalDistanceKm, 0);
      assert.strictEqual(result.totalTrips, 0);
      assert.strictEqual(result.totalActiveHours, 0);
      assert.strictEqual(result.avgDistancePerTrip, 0);
      assert.strictEqual(result.activeVehiclesCount, 0);
    });

    test('handles zero trips to avoid division by zero', () => {
      const reports = [
        {
          date: '2023-10-01',
          vehicle_id: 'v1',
          plate_number: 'ABC-123',
          total_trips: 0,
          total_distance_km: 0,
          active_duration_hours: 0
        }
      ];
      const result = calculateReportTotals(reports);
      assert.strictEqual(result.avgDistancePerTrip, 0);
    });
  });

  describe('generateCsvContent', () => {
    test('formats csv string and includes UTF-8 BOM', () => {
      const reports = [
        {
          date: '2023-10-01',
          vehicle_id: 'v1',
          plate_number: 'ABC-123',
          total_trips: 2,
          total_distance_km: 10.5,
          active_duration_hours: 2.1
        }
      ];

      const csv = generateCsvContent(reports);
      assert.ok(csv.startsWith('\uFEFF'));
      assert.ok(csv.includes('Date,Plate Number,Total Trips,Total Distance (km),Active Duration (hours),Avg Distance/Trip (km)'));
      assert.ok(csv.includes('2023-10-01,ABC-123,2,10.50,2.10,5.25'));
    });
  });

  describe('getDatePresetRange', () => {
    test('returns correct preset strings', () => {
      const todayRange = getDatePresetRange('today');
      assert.ok(todayRange.start_date);
      assert.strictEqual(todayRange.start_date, todayRange.end_date);

      const thisMonth = getDatePresetRange('this_month');
      assert.ok(thisMonth.start_date.endsWith('-01'));
    });
  });
});
