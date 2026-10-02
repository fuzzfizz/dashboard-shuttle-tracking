import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, filterFleet } from '../src/lib/utils.ts';

describe('formatDistance', () => {
  it('formats positive numbers to 1 decimal place with กม. suffix', () => {
    assert.equal(formatDistance(42.84), '42.8 กม.');
    assert.equal(formatDistance(42.8), '42.8 กม.');
    assert.equal(formatDistance(100), '100.0 กม.');
    assert.equal(formatDistance(0.55), '0.6 กม.');
  });

  it('handles 0, null, and undefined gracefully as 0.0 กม.', () => {
    assert.equal(formatDistance(0), '0.0 กม.');
    assert.equal(formatDistance(null), '0.0 กม.');
    assert.equal(formatDistance(undefined), '0.0 กม.');
    assert.equal(formatDistance(), '0.0 กม.');
  });

  it('handles negative numbers or NaN safely by returning 0.0 กม.', () => {
    assert.equal(formatDistance(-10), '0.0 กม.');
    assert.equal(formatDistance(Number.NaN), '0.0 กม.');
  });
});

describe('filterFleet', () => {
  const sampleVehicles = [
    {
      id: 'v1',
      plate_number: '1กข-1234',
      name: 'Van Alpha',
      model: 'Toyota Commuter',
      status: 'in_transit',
      current_route_id: 'route-north',
      route_id: 'route-north',
      route_name: 'สายเหนือ มช.',
      today_total_km: 42.8,
      today_total_trips: 4,
      current_trip_km: 8.2,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'v2',
      plate_number: '2ขค-5678',
      name: 'Shuttle Beta',
      model: 'Nissan Urvan',
      status: 'idle',
      current_route_id: 'route-south',
      route_id: 'route-south',
      route_name: 'สายใต้ มช.',
      today_total_km: 15.0,
      today_total_trips: 2,
      current_trip_km: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'v3',
      plate_number: '3งจ-9999',
      name: 'Reserve Bus',
      model: 'Toyota Coaster',
      status: 'offline',
      current_route_id: null,
      route_id: null,
      route_name: undefined,
      today_total_km: 0,
      today_total_trips: 0,
      current_trip_km: 0,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'v4',
      plate_number: '4ฉช-7777',
      name: 'Express EV',
      model: 'BYD B7',
      status: 'in_transit',
      current_route_id: 'route-north',
      route_id: 'route-north',
      route_name: 'สายเหนือ มช.',
      today_total_km: 85.5,
      today_total_trips: 8,
      current_trip_km: 12.4,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  it('returns all vehicles when no filters or default filters applied', () => {
    const result = filterFleet(sampleVehicles, '', 'all', 'all');
    assert.equal(result.length, 4);
    assert.deepEqual(result.map(v => v.id), ['v1', 'v2', 'v3', 'v4']);
  });

  it('filters by status (in_transit, idle, offline)', () => {
    const inTransit = filterFleet(sampleVehicles, '', 'in_transit', 'all');
    assert.equal(inTransit.length, 2);
    assert.deepEqual(inTransit.map(v => v.id), ['v1', 'v4']);

    const idle = filterFleet(sampleVehicles, '', 'idle', 'all');
    assert.equal(idle.length, 1);
    assert.equal(idle[0].id, 'v2');

    const offline = filterFleet(sampleVehicles, '', 'offline', 'all');
    assert.equal(offline.length, 1);
    assert.equal(offline[0].id, 'v3');
  });

  it('handles case-insensitive and spaced status values like "In Transit"', () => {
    const inTransit = filterFleet(sampleVehicles, '', 'In Transit', 'all');
    assert.equal(inTransit.length, 2);
    assert.deepEqual(inTransit.map(v => v.id), ['v1', 'v4']);
  });

  it('filters by routeId (specific route, all, unassigned)', () => {
    const northRoute = filterFleet(sampleVehicles, '', 'all', 'route-north');
    assert.equal(northRoute.length, 2);
    assert.deepEqual(northRoute.map(v => v.id), ['v1', 'v4']);

    const southRoute = filterFleet(sampleVehicles, '', 'all', 'route-south');
    assert.equal(southRoute.length, 1);
    assert.equal(southRoute[0].id, 'v2');

    const unassigned = filterFleet(sampleVehicles, '', 'all', 'unassigned');
    assert.equal(unassigned.length, 1);
    assert.equal(unassigned[0].id, 'v3');
  });

  it('filters by search query matching plate_number, model, name, or route_name case-insensitively', () => {
    // Plate number match
    const byPlate = filterFleet(sampleVehicles, '1กข');
    assert.equal(byPlate.length, 1);
    assert.equal(byPlate[0].id, 'v1');

    // Model match (case-insensitive)
    const byModel = filterFleet(sampleVehicles, 'coaster');
    assert.equal(byModel.length, 1);
    assert.equal(byModel[0].id, 'v3');

    // Name match (case-insensitive)
    const byName = filterFleet(sampleVehicles, 'express');
    assert.equal(byName.length, 1);
    assert.equal(byName[0].id, 'v4');

    // Route name match
    const byRouteName = filterFleet(sampleVehicles, 'สายใต้');
    assert.equal(byRouteName.length, 1);
    assert.equal(byRouteName[0].id, 'v2');
  });

  it('combines search query, status, and route filters', () => {
    const combined = filterFleet(sampleVehicles, 'byd', 'in_transit', 'route-north');
    assert.equal(combined.length, 1);
    assert.equal(combined[0].id, 'v4');

    const noMatch = filterFleet(sampleVehicles, 'byd', 'idle', 'route-north');
    assert.equal(noMatch.length, 0);
  });

  it('handles empty list or invalid inputs gracefully', () => {
    assert.deepEqual(filterFleet([], 'test'), []);
    assert.deepEqual(filterFleet(null, 'test'), []);
    assert.deepEqual(filterFleet(undefined, 'test'), []);
  });
});
