export default async function tripRoutes(fastify, options) {
  const { db } = fastify;

  fastify.get('/:id', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    
    const { rows } = await db.query(`
      SELECT t.*, v.plate_number, v.name as vehicle_name 
      FROM trips t
      JOIN vehicles v ON t.vehicle_id = v.id
      WHERE t.id = $1
    `, [id]);

    if (rows.length === 0) {
      return reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Trip not found' } });
    }

    return { success: true, data: rows[0] };
  });

  fastify.get('/:id/track', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params;
    
    const tripRes = await db.query(`SELECT total_distance_km FROM trips WHERE id = $1`, [id]);
    const total_distance_km = tripRes.rows.length > 0 ? Number(tripRes.rows[0].total_distance_km || 0) : 0;

    const { rows } = await db.query(`
      SELECT lat, lng, speed_kmh, heading, server_timestamp 
      FROM gps_points 
      WHERE trip_id = $1 AND is_valid = true
      ORDER BY server_timestamp ASC
    `, [id]);

    const coordinates = rows.map(p => [p.lng, p.lat]);

    return { 
      success: true, 
      data: {
        trip_id: id,
        coordinates,
        total_points: rows.length,
        total_distance_km
      } 
    };
  });
}
