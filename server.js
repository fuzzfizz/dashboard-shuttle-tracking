import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { startWorker } from './tools/worker.js';

dotenv.config();
// Also load tools/.env if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolsEnvPath = path.join(__dirname, 'tools', '.env');
if (fs.existsSync(toolsEnvPath)) {
  dotenv.config({ path: toolsEnvPath });
}

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'frontend', 'dist');

// Start the background MQTT ingestion engine
const worker = startWorker();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url ? req.url.split('?')[0] : '/';

  // 1. Health check & status endpoints
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'shuttle-tracking-unified',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        worker: worker.getStats(),
      })
    );
    return;
  }

  if (urlPath === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(worker.getStats()));
    return;
  }

  // 2. Serve static frontend assets from frontend/dist
  let safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // If dist doesn't exist yet, return friendly message
  if (!fs.existsSync(DIST_DIR)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Frontend build not found. Please run "npm run build" first.');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.stat(filePath, (fileErr, fileStats) => {
      // If file exists and is a regular file, stream it
      if (!fileErr && fileStats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileStats.size,
          // Cache static assets with hashes in /assets for 1 year, index.html no-cache
          'Cache-Control': filePath.includes('assets')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      } else {
        // SPA Fallback: serve index.html for unknown client-side routes
        const indexPath = path.join(DIST_DIR, 'index.html');
        fs.stat(indexPath, (indexErr, indexStats) => {
          if (!indexErr && indexStats.isFile()) {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
            });
            fs.createReadStream(indexPath).pipe(res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          }
        });
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`[Unified Server] Running on http://localhost:${PORT}`);
  console.log(`[Unified Server] Serving frontend from: ${DIST_DIR}`);
  console.log(`[Unified Server] Health check available at: http://localhost:${PORT}/health`);
});

// Graceful shutdown handling
let isShuttingDown = false;
const handleShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Unified Server] Received ${signal}. Gracefully shutting down...`);

  server.close(() => {
    console.log('[Unified Server] HTTP server closed.');
  });

  try {
    await worker.shutdown();
  } catch (err) {
    console.error('[Unified Server] Error shutting down worker:', err.message);
  }

  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
