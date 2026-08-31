import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import config from '../config/env.js';

async function authPlugin(fastify, opts) {
  const secret = opts.jwtSecret || config.JWT_SECRET;

  await fastify.register(fastifyJwt, {
    secret,
  });

  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication token',
        },
      });
    }
  });

  fastify.decorate('requireRole', function (allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return async function (request, reply) {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }
      if (!roles.includes(request.user.role)) {
        return reply.code(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
          },
        });
      }
    };
  });

  fastify.decorate('verifyDeviceKey', async function (request, reply) {
    const deviceKey = request.headers['x-device-key'];
    if (!deviceKey) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'MISSING_KEY',
          message: 'X-Device-Key header is required',
        },
      });
    }

    const db = fastify.db;
    const result = await db.query(
      `SELECT id, plate_number, name, device_api_key, status, is_active, last_lat, last_lng, last_speed_kmh, last_heading, last_seen_at
       FROM vehicles
       WHERE device_api_key = $1 AND is_active = true
       LIMIT 1;`,
      [deviceKey]
    );

    const vehicle = result.rows && result.rows[0];
    if (!vehicle) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'INVALID_KEY',
          message: 'Invalid or inactive device key',
        },
      });
    }

    request.vehicle = vehicle;
  });
}

export default fp(authPlugin);
