import buildApp from './app.js';
import config from './config/env.js';
import { closePool } from './db/index.js';

const app = buildApp({
  logger: {
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  },
});

async function start() {
  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    app.log.info(`Shuttle Tracking API Server running at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const signals = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, closing server...`);
    await app.close();
    await closePool();
    process.exit(0);
  });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  start();
}

export { app, start };
