export default async function routesRoutes(fastify, options) {
  const { db } = fastify;

  fastify.get('/', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const { rows } = await db.query(`
      SELECT r.*, COUNT(rs.id) as stop_count
      FROM routes r
      LEFT JOIN route_stops rs ON r.id = rs.route_id
      GROUP BY r.id
      ORDER BY r.id ASC
    `);
    
    return { success: true, data: rows };
  });

  fastify.get('/:id', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    
    const { rows } = await db.query(`
      SELECT * FROM routes WHERE id = $1
    `, [id]);

    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    }

    const route = rows[0];
    
    const stopsRes = await db.query(`
      SELECT * FROM route_stops WHERE route_id = $1 ORDER BY stop_order ASC
    `, [id]);

    route.stops = stopsRes.rows;

    return { success: true, data: route };
  });

  fastify.post('/', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { name, description, route_geojson, stops } = request.body;
    
    // In real implementation, this should be a transaction
    const { rows } = await db.query(`
      INSERT INTO routes (name, description, route_geojson)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, description, route_geojson || null]);

    const route = rows[0];

    if (stops && Array.isArray(stops)) {
      for (const stop of stops) {
        await db.query(`
          INSERT INTO route_stops (route_id, name, lat, lng, stop_order, radius_meters)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [route.id, stop.name, stop.lat, stop.lng, stop.stop_order, stop.radius_meters || 50]);
      }
    }

    return reply.code(201).send({ success: true, data: route });
  });

  fastify.put('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, route_geojson, stops } = request.body;
    
    const { rows } = await db.query(`
      UPDATE routes 
      SET name = $1, description = $2, route_geojson = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [name, description, route_geojson || null, id]);

    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    }

    if (stops && Array.isArray(stops)) {
      await db.query(`DELETE FROM route_stops WHERE route_id = $1`, [id]);
      for (const stop of stops) {
        await db.query(`
          INSERT INTO route_stops (route_id, name, lat, lng, stop_order, radius_meters)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, stop.name, stop.lat, stop.lng, stop.stop_order, stop.radius_meters || 50]);
      }
    }

    return { success: true, data: rows[0] };
  });

  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { id } = request.params;
    
    await db.query(`DELETE FROM route_stops WHERE route_id = $1`, [id]);
    const { rowCount } = await db.query(`DELETE FROM routes WHERE id = $1`, [id]);

    if (rowCount === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
    }

    return { success: true };
  });
}
