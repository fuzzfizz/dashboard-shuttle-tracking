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
    
    let client;
    try {
      client = await db.getClient();
      await client.query('BEGIN');
      
      const { rows } = await client.query(`
        INSERT INTO routes (name, description, route_geojson)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [name, description, route_geojson || null]);

      const route = rows[0];

      if (stops && Array.isArray(stops) && stops.length > 0) {
        const values = [];
        const params = [];
        let i = 1;
        for (const stop of stops) {
          values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
          params.push(route.id, stop.name, stop.lat, stop.lng, stop.stop_order, stop.radius_meters || 50);
        }
        await client.query(`
          INSERT INTO route_stops (route_id, name, lat, lng, stop_order, radius_meters)
          VALUES ${values.join(', ')}
        `, params);
      }

      await client.query('COMMIT');
      return reply.code(201).send({ success: true, data: route });
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (client) client.release();
    }
  });

  fastify.put('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, description, route_geojson, stops } = request.body;
    
    let client;
    try {
      client = await db.getClient();
      await client.query('BEGIN');
      
      const { rows } = await client.query(`
        UPDATE routes 
        SET name = $1, description = $2, route_geojson = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [name, description, route_geojson || null, id]);

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
      }

      if (stops && Array.isArray(stops)) {
        await client.query(`DELETE FROM route_stops WHERE route_id = $1`, [id]);
        if (stops.length > 0) {
          const values = [];
          const params = [];
          let i = 1;
          for (const stop of stops) {
            values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
            params.push(id, stop.name, stop.lat, stop.lng, stop.stop_order, stop.radius_meters || 50);
          }
          await client.query(`
            INSERT INTO route_stops (route_id, name, lat, lng, stop_order, radius_meters)
            VALUES ${values.join(', ')}
          `, params);
        }
      }

      await client.query('COMMIT');
      return { success: true, data: rows[0] };
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (client) client.release();
    }
  });

  fastify.delete('/:id', {
    preValidation: [fastify.authenticate, fastify.requireRole(['admin'])]
  }, async (request, reply) => {
    const { id } = request.params;
    
    let client;
    try {
      client = await db.getClient();
      await client.query('BEGIN');
      
      await client.query(`DELETE FROM route_stops WHERE route_id = $1`, [id]);
      const { rowCount } = await client.query(`DELETE FROM routes WHERE id = $1`, [id]);

      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      if (client) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (client) client.release();
    }
  });
}
