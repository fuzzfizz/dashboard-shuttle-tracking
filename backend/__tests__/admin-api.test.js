import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import buildApp from '../src/app.js';
import crypto from 'crypto';

function createMockDb() {
  const data = {
    vehicles: [],
    trips: [],
    gps_points: [],
    routes: [],
    route_stops: [],
  };


  const queries = [];

  return {
    data,
    queries,
    async query(text, params = []) {
      queries.push({ text, params });
      const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

      // Vehicle listing
      if (sql.includes('from vehicles') && (!sql.includes('where id =') && !sql.includes('update') && !sql.includes('insert'))) {
        return { rows: data.vehicles.filter(v => v.is_active !== false) };
      }

      // Single vehicle
      if (sql.includes('select') && sql.includes('from vehicles') && sql.includes('where id =')) {
        return { rows: data.vehicles.filter(v => v.id == params[0]) };
      }

      // Insert vehicle
      if (sql.includes('insert into vehicles')) {
        const v = {
          id: data.vehicles.length + 1,
          plate_number: params[0],
          name: params[1],
          route_id: params[2],
          device_api_key: params[3],
          is_active: true,
          status: 'offline'
        };
        data.vehicles.push(v);
        return { rows: [v] };
      }

      // Update vehicle
      if (sql.includes('update vehicles') && !sql.includes('is_active = false')) {
        const idIdx = params.length - 1; // Assuming id is the last parameter in PUT
        const v = data.vehicles.find(v => v.id == params[idIdx]);
        if (v) {
          v.plate_number = params[0] !== undefined ? params[0] : v.plate_number;
          v.name = params[1] !== undefined ? params[1] : v.name;
          v.route_id = params[2] !== undefined ? params[2] : v.route_id;
          v.is_active = params[3] !== undefined ? params[3] : v.is_active;
        }
        return { rows: v ? [v] : [] };
      }

      // Delete vehicle (soft)
      if (sql.includes('update vehicles set is_active = false') || (sql.includes('update vehicles') && sql.includes('is_active = false') && params.length === 1)) {
        const v = data.vehicles.find(v => v.id == params[0]);
        if (v) v.is_active = false;
        return { rows: v ? [v] : [] };
      }

      // Trips for vehicle date
      if (sql.includes('from trips') && sql.includes('vehicle_id = $1') && sql.includes('date(')) {
        return { rows: data.trips.filter(t => t.vehicle_id == params[0]) };
      }

      // Single trip
      if (sql.includes('from trips') && sql.includes('where id = $1')) {
        return { rows: data.trips.filter(t => t.id == params[0]) };
      }

      // Trip track
      if (sql.includes('from gps_points') && sql.includes('trip_id = $1')) {
        return { rows: data.gps_points.filter(p => p.trip_id == params[0]) };
      }

      // Routes listing
      if (sql.includes('from routes') && !sql.includes('where id = $1') && !sql.includes('insert') && !sql.includes('update') && !sql.includes('delete')) {
        return { rows: data.routes };
      }

      // Route single
      if (sql.includes('from routes') && sql.includes('where id = $1')) {
        return { rows: data.routes.filter(r => r.id == params[0]) };
      }
      if (sql.includes('from route_stops') && sql.includes('route_id = $1')) {
        return { rows: data.route_stops.filter(s => s.route_id == params[0]) };
      }

      // Route insert
      if (sql.includes('insert into routes')) {
        const r = { id: data.routes.length + 1, name: params[0], description: params[1], route_geojson: params[2] };
        data.routes.push(r);
        return { rows: [r] };
      }
      
      // Route update
      if (sql.includes('update routes')) {
        const r = data.routes.find(r => r.id == params[3]);
        if (r) {
          r.name = params[0];
          r.description = params[1];
          r.route_geojson = params[2];
        }
        return { rows: r ? [r] : [] };
      }

      // Route delete
      if (sql.includes('delete from routes')) {
        data.routes = data.routes.filter(r => r.id != params[0]);
        return { rowCount: 1 };
      }

      // Route stops insert
      if (sql.includes('insert into route_stops')) {
        return { rowCount: 1 };
      }

      // Route stops delete
      if (sql.includes('delete from route_stops')) {
        return { rowCount: 1 };
      }

      // Reports daily
      if (sql.includes('daily_mileage_summary') && !sql.includes('between')) {
        return { rows: [{ date: params[0] || '2024-01-01', fleet_total_km: 100 }] };
      }

      // Reports range
      if (sql.includes('daily_mileage_summary') && sql.includes('between')) {
        return { rows: [{ date: params[0], fleet_total_km: 100 }, { date: params[1], fleet_total_km: 150 }] };
      }

      return { rows: [] };
    }
  };
}

describe('Admin API', () => {
  let app;
  let db;
  let adminToken;
  let viewerToken;
  let mqttService;

  beforeEach(async () => {
    db = createMockDb();
    
    mqttService = {
      sendCommand: async (id, payload) => {
        return true;
      }
    };

    app = buildApp({
      db,
      jwtSecret: 'test-secret',
      logger: false
    });
    
    app.decorate('mqttService', mqttService);

    await app.ready();
    
    adminToken = app.jwt.sign({ id: 1, role: 'admin' });
    viewerToken = app.jwt.sign({ id: 2, role: 'viewer' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('Vehicles: GET /api/v1/vehicles returns active vehicles', async () => {
    db.data.vehicles.push({ id: 1, plate_number: 'TEST01', name: 'Bus 1', is_active: true });
    
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    
    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].plate_number, 'TEST01');
  });

  it('Vehicles: POST /api/v1/vehicles requires admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { plate_number: 'NEW01', name: 'New Bus' }
    });
    
    assert.equal(res.statusCode, 403);
  });

  it('Vehicles: POST /api/v1/vehicles creates vehicle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { plate_number: 'NEW01', name: 'New Bus' }
    });
    
    assert.equal(res.statusCode, 201, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.plate_number, 'NEW01');
    assert.ok(body.data.device_api_key.startsWith('dev_key_'));
  });

  it('Vehicles: PUT /api/v1/vehicles/:id updates vehicle', async () => {
    db.data.vehicles.push({ id: 1, plate_number: 'TEST01', name: 'Bus 1', is_active: true });
    
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/vehicles/1',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { plate_number: 'TEST02', name: 'Bus 1 Updated', route_id: null, is_active: true }
    });
    
    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.plate_number, 'TEST02');
  });

  it('Vehicles: DELETE /api/v1/vehicles/:id soft deletes', async () => {
    db.data.vehicles.push({ id: 1, plate_number: 'TEST01', name: 'Bus 1', is_active: true });
    
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/vehicles/1',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    
    assert.equal(res.statusCode, 200, res.payload);
    assert.equal(db.data.vehicles[0].is_active, false);
  });

  it('Vehicles: POST /api/v1/vehicles/:id/command sends MQTT command', async () => {
    db.data.vehicles.push({ id: 1, plate_number: 'TEST01', name: 'Bus 1', is_active: true });
    let commandSent = false;
    mqttService.sendCommand = async (id, payload) => {
      if (id == 1 && payload.action === 'reboot') commandSent = true;
    };
    
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles/1/command',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { action: 'reboot', params: {} }
    });
    
    assert.equal(res.statusCode, 200, res.payload);
    assert.ok(commandSent);
  });

  it('Trips: GET /api/v1/vehicles/:id/trips', async () => {
    db.data.trips.push({ id: 10, vehicle_id: 1, total_distance_km: 5.5 });
    
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vehicles/1/trips',
      headers: { authorization: `Bearer ${viewerToken}` }
    });
    
    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
  });

  it('Trips: GET /api/v1/trips/:id/track', async () => {
    db.data.gps_points.push({ trip_id: 10, lat: 10, lng: 20 });
    
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/trips/10/track',
      headers: { authorization: `Bearer ${viewerToken}` }
    });
    
    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.coordinates);
  });

  it('Routes: POST /api/v1/routes creates route', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/routes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Route A', stops: [{ name: 'Stop 1', lat: 1, lng: 2, stop_order: 1 }] }
    });
    
    assert.equal(res.statusCode, 201, res.payload);
  });

  it('Reports: GET /api/v1/reports/daily', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reports/daily?date=2024-01-01',
      headers: { authorization: `Bearer ${viewerToken}` }
    });
    
    assert.equal(res.statusCode, 200, res.payload);
    assert.equal(res.json().data.fleet_total_km, 100);
  });
});
