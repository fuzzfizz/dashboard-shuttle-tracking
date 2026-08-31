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
}

export default fp(authPlugin);
