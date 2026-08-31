import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import defaultDb from './db/index.js';
import config from './config/env.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';

export function buildApp(opts = {}) {
  const app = Fastify({
    logger: opts.logger ?? (config.NODE_ENV === 'test' ? false : true),
    ...opts,
  });

  // DB Decorator
  const db = opts.db || defaultDb;
  if (!app.hasDecorator('db')) {
    app.decorate('db', db);
  }

  // Register CORS
  app.register(fastifyCors, {
    origin: opts.corsOrigin ?? config.CORS_ORIGIN,
  });

  // Register Auth Plugin
  app.register(authPlugin, {
    jwtSecret: opts.jwtSecret || config.JWT_SECRET,
  });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // Register API Routes
  app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Custom 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
      },
    });
  });

  // Custom Error handler
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const code =
      error.code ||
      (statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR');
    const message = error.message || 'An internal server error occurred';

    if (statusCode >= 500 && app.log) {
      app.log.error(error);
    }

    reply.code(statusCode).send({
      success: false,
      error: {
        code,
        message,
      },
    });
  });

  return app;
}

export default buildApp;
