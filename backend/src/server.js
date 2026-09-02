import buildApp from './app.js';
import config from './config/env.js';
import { closePool } from './db/index.js';

const app = buildApp({
  logger: {
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  },
});

import { createMqttIngestService } from './services/mqtt-ingest.js';
import defaultDb from './db/index.js';

async function start() {
  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
    app.log.info(`Shuttle Tracking API Server running at ${address}`);

    if (config.NODE_ENV !== 'test') {
      app.mqttService = createMqttIngestService({
        dbClient: defaultDb,
        logger: app.log,
        onBroadcastLocation: (payload) => app.broadcaster?.broadcastLocation(payload),
        onBroadcastStatus: (payload) => app.broadcaster?.broadcastStatus(payload),
        onTripEvent: (eventName, payload) => app.broadcaster?.broadcastTripEvent(eventName, payload),
        onCommandResponse: (payload) => app.broadcaster?.broadcastCommandResponse(payload),
      });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const signals = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, closing server...`);
    if (app.mqttService) {
      await app.mqttService.close();
    }
    await app.close();
    await closePool();
    process.exit(0);
  });
}

import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1]) {
  try {
    const currentPath = fileURLToPath(import.meta.url);
    const execPath = path.resolve(process.argv[1]);
    if (currentPath === execPath || import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
      start();
    }
  } catch {
    start();
  }
}

export { app, start };
