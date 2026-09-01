export default async function reportsRoutes(fastify, options) {
  const { db } = fastify;

  fastify.get('/daily', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const date = request.query.date || new Date().toISOString().split('T')[0];
    
    const { rows } = await db.query(`
      SELECT * FROM daily_mileage_summary WHERE date = $1
    `, [date]);

    let fleet_total_km = 0;
    if (rows.length > 0) {
      fleet_total_km = rows.reduce((sum, row) => sum + Number(row.fleet_total_km || 0), 0) || rows[0].fleet_total_km || 0;
    }

    return { 
      success: true, 
      data: {
        date,
        vehicles: rows,
        fleet_total_km
      } 
    };
  });

  fastify.get('/range', {
    preValidation: [fastify.authenticate]
  }, async (request, reply) => {
    const fromDate = request.query.from;
    const toDate = request.query.to;
    
    if (!fromDate || !toDate) {
      return reply.code(400).send({ success: false, error: { code: 'BAD_REQUEST', message: 'from and to query params are required' }});
    }

    const { rows } = await db.query(`
      SELECT * FROM daily_mileage_summary WHERE date BETWEEN $1 AND $2
    `, [fromDate, toDate]);

    const total_fleet_distance = rows.reduce((sum, r) => sum + Number(r.total_distance_km || r.fleet_total_km || 0), 0);
    const total_trips = rows.reduce((sum, r) => sum + Number(r.total_trips || 0), 0);

    return { 
      success: true, 
      data: {
        from: fromDate,
        to: toDate,
        total_fleet_distance,
        total_trips,
        records: rows
      } 
    };
  });
}
