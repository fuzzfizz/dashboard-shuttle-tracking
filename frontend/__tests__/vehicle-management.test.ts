import test from 'node:test';
import assert from 'node:assert/strict';
import { maskApiKey, validateCommandPayload, filterVehicles } from '../src/lib/vehicle-utils.ts';

test('Vehicle Utils - API Key Masking', async (t) => {
  await t.test('masks standard api key correctly', () => {
    const key = 'dev_abc123def456ghi789jkl012mno345pqr';
    assert.equal(maskApiKey(key), 'dev_abc1...5pqr');
  });

  await t.test('returns original if too short', () => {
    const key = 'short';
    assert.equal(maskApiKey(key), 'short');
  });
});

test('Vehicle Utils - Command Payload Validation', async (t) => {
  await t.test('validates set_interval', () => {
    assert.equal(validateCommandPayload('set_interval', { interval: 5000 }), true);
    assert.equal(validateCommandPayload('set_interval', { interval: 999 }), false); // too low
    assert.equal(validateCommandPayload('set_interval', {}), false);
  });

  await t.test('validates reboot', () => {
    assert.equal(validateCommandPayload('reboot', {}), true);
  });

  await t.test('validates check_ota', () => {
    assert.equal(validateCommandPayload('check_ota', {}), true);
  });
});

test('Vehicle Utils - Vehicle Filtering', async (t) => {
  const vehicles: any[] = [
    { plate_number: 'AB-1234', model: 'Toyota', current_route_id: 'r1', status: 'In Transit' },
    { plate_number: 'XY-9999', model: 'Honda', current_route_id: 'r2', status: 'Idle' },
    { plate_number: 'CD-5678', model: 'Toyota Commuter', current_route_id: null, status: 'Offline' }
  ];

  await t.test('filters by search text', () => {
    const result = filterVehicles(vehicles, 'toyota', 'all', 'all');
    assert.equal(result.length, 2);
    assert.equal(result[0].plate_number, 'AB-1234');
    assert.equal(result[1].plate_number, 'CD-5678');
  });

  await t.test('filters by route', () => {
    const result = filterVehicles(vehicles, '', 'r1', 'all');
    assert.equal(result.length, 1);
    assert.equal(result[0].plate_number, 'AB-1234');
  });

  await t.test('filters by unassigned route', () => {
    const result = filterVehicles(vehicles, '', 'unassigned', 'all');
    assert.equal(result.length, 1);
    assert.equal(result[0].plate_number, 'CD-5678');
  });

  await t.test('filters by status', () => {
    const result = filterVehicles(vehicles, '', 'all', 'Idle');
    assert.equal(result.length, 1);
    assert.equal(result[0].plate_number, 'XY-9999');
  });
});
