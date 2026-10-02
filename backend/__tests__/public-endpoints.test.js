import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import buildApp from '../src/app.js';

function createMockDb() {
  const data = {
    vehicles: [],
    routes: [],
    route_stops: [],
  };

  const db = {
    data,
    getClient: async () => ({
      query: async (text, params) => db.query(text, params),
      release: () => {}
    }),
    async query(text, params = []) {
      const sql = text.replace(/\s+/g, ' ').trim().toLowerCase();

      // Vehicle listing
      if (sql.includes('from vehicles') && !sql.includes('where id =') && !sql.includes('update') && !sql.includes('insert')) {
        return { rows: data.vehicles.filter(v => v.is_active !== false) };
      }

      // Single vehicle
      if (sql.includes('from vehicles') && sql.includes('where id =')) {
        return { rows: data.vehicles.filter(v => v.id == params[0] && v.is_active !== false) };
      }

      // Route listing
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

      return { rows: [] };
    }
  };

  return db;
}

describe('Public Endpoints (Vehicles and Routes)', () => {
  let app;
  let db;

  beforeEach(async () => {
    db = createMockDb();
    app = buildApp({
      db,
      jwtSecret: 'test-secret',
      logger: false
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/vehicles returns 200 without Authorization header, with today_total_km', async () => {
    db.data.vehicles.push({
      id: 1,
      plate_number: 'B 1234 XYZ',
      name: 'Shuttle Alpha',
      route_id: 1,
      route_name: 'Campus Express',
      today_total_km: 42.5,
      today_total_trips: 3,
      current_trip_km: 5.2,
      is_active: true
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vehicles'
    });

    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].plate_number, 'B 1234 XYZ');
    assert.equal(body.data[0].today_total_km, 42.5);
    assert.equal(body.data[0].today_total_trips, 3);
    assert.equal(body.data[0].current_trip_km, 5.2);
    assert.equal(body.data[0].route_name, 'Campus Express');
  });

  it('GET /api/v1/vehicles/:id returns 200 without Authorization header', async () => {
    db.data.vehicles.push({
      id: 2,
      plate_number: 'B 5678 ABC',
      name: 'Shuttle Beta',
      is_active: true
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/vehicles/2'
    });

    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, 2);
    assert.equal(body.data.plate_number, 'B 5678 ABC');
  });

  it('GET /api/v1/routes returns 200 without Authorization header', async () => {
    db.data.routes.push({
      id: 1,
      name: 'Campus Express',
      description: 'North to South route',
      stop_count: 5
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/routes'
    });

    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].name, 'Campus Express');
  });

  it('GET /api/v1/routes/:id returns 200 without Authorization header with stops', async () => {
    db.data.routes.push({
      id: 1,
      name: 'Campus Express',
      description: 'North to South route'
    });
    db.data.route_stops.push(
      { id: 101, route_id: 1, name: 'Main Gate', stop_order: 1, lat: -6.2, lng: 106.8 },
      { id: 102, route_id: 1, name: 'Library', stop_order: 2, lat: -6.21, lng: 106.81 }
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/routes/1'
    });

    assert.equal(res.statusCode, 200, res.payload);
    const body = res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, 1);
    assert.equal(body.data.stops.length, 2);
  });

  it('POST /api/v1/vehicles returns 401 without Authorization header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/vehicles',
      payload: { plate_number: 'NEW01', name: 'New Vehicle' }
    });

    assert.equal(res.statusCode, 401, res.payload);
  });

  it('POST /api/v1/routes returns 401 without Authorization header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/routes',
      payload: { name: 'New Route' }
    });

    assert.equal(res.statusCode, 401, res.payload);
  });

  it('PUT /api/v1/vehicles/:id returns 401 without Authorization header', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/vehicles/1',
      payload: { name: 'Updated Vehicle' }
    });

    assert.equal(res.statusCode, 401, res.payload);
  });

  it('DELETE /api/v1/vehicles/:id returns 401 without Authorization header', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/vehicles/1'
    });

    assert.equal(res.statusCode, 401, res.payload);
  });
});
