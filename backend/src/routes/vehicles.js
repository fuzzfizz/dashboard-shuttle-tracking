import crypto from 'crypto';

export default async function vehicleRoutes(fastify, options) {
  const { db } = fastify;

  fastify.get('/', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const { rows } = await db.query(`
      SELECT 
        v.*, 
        r.name as route_name,
        COALESCE(SUM(t_all.total_distance_km) FILTER (WHERE DATE(t_all.started_at) = CURRENT_DATE), 0) as today_total_km,
        COUNT(t_all.id) FILTER (WHERE DATE(t_all.started_at) = CURRENT_DATE) as today_total_trips,
        COALESCE(SUM(t_curr.total_distance_km), 0) as current_trip_km
      FROM vehicles v
      LEFT JOIN routes r ON v.route_id = r.id
      LEFT JOIN trips t_all ON t_all.vehicle_id = v.id
      LEFT JOIN trips t_curr ON t_curr.vehicle_id = v.id AND t_curr.status IN ('in_transit', 'active')
      WHERE v.is_active = true
      GROUP BY v.id, r.name
    `);
    
    const data = rows.map(v => ({
      ...v,
      today_total_km: Number(v.today_total_km || 0),
      today_total_trips: Number(v.today_total_trips || 0),
      current_trip_km: Number(v.current_trip_km || 0)
    }));

    return { success: true, data };
  });

  fastify.get('/:id', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const { rows } = await db.query('SELECT * FROM vehicles WHERE id = $1 AND is_active = true', [id]);
    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    }
    return { success: true, data: rows[0] };
  });

  fastify.post('/', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { plate_number, name, route_id } = request.body;
    const device_api_key = 'dev_key_' + crypto.randomBytes(16).toString('hex');
    
    const { rows } = await db.query(`
      INSERT INTO vehicles (plate_number, name, route_id, device_api_key)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [plate_number, name, route_id, device_api_key]);

    return reply.code(201).send({ success: true, data: rows[0] });
  });

  fastify.put('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { id } = request.params;
    const { plate_number, name, route_id, is_active } = request.body;
    
    const { rows } = await db.query(`
      UPDATE vehicles 
      SET plate_number = $1, name = $2, route_id = $3, is_active = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [plate_number, name, route_id, is_active, id]);

    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    }

    return { success: true, data: rows[0] };
  });

  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { id } = request.params;
    
    const { rows } = await db.query(`
      UPDATE vehicles 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Vehicle not found' } });
    }

    return { success: true };
  });

  fastify.post('/:id/command', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { id } = request.params;
    const { action, params } = request.body;
    
    const { rows } = await db.query('SELECT * FROM vehicles WHERE id = $1 AND is_active = true', [id]);
    if (rows.length === 0) {
      return reply.code(404).send({ success: false, message: 'Vehicle not found' });
    }

    if (fastify.mqttService) {
      await fastify.mqttService.sendCommand(id, { action, params });
    }

    return { success: true, data: { command_id: crypto.randomUUID(), status: 'sent' } };
  });

  fastify.get('/:id/trips', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    const date = request.query.date || new Date().toISOString().split('T')[0];
    
    const { rows } = await db.query(`
      SELECT * FROM trips 
      WHERE vehicle_id = $1 AND DATE(started_at) = $2
    `, [id, date]);

    const daily_total_km = rows.reduce((sum, row) => sum + Number(row.total_distance_km || 0), 0);

    return { success: true, daily_total_km, data: rows };
  });
}

