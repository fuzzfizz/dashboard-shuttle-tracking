import fp from 'fastify-plugin';
import fastifyWebsocket from '@fastify/websocket';
import BroadcasterService from '../services/broadcaster.js';

async function websocketPlugin(fastify, options) {
  const broadcaster = new BroadcasterService();
  
  // Decorate fastify with broadcaster
  fastify.decorate('broadcaster', broadcaster);

  // Register fastify-websocket
  await fastify.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576, // 1MB
    }
  });

  // Public websocket endpoint
  fastify.get('/ws/public', { websocket: true }, (socket, req) => {
    // fastify-websocket passes (socket, req) where socket is a WebSocket instance
    const clientData = broadcaster.addClient(socket, { isAdmin: false, vehicleFilter: null });

    socket.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        if (msg.action === 'ping') {
          socket.send(JSON.stringify({ event: 'pong', timestamp: new Date().toISOString() }));
        } else if (msg.action === 'subscribe') {
          broadcaster.updateFilter(clientData, { vehicle_ids: msg.vehicle_ids });
        } else if (msg.action === 'unsubscribe') {
          // If a specific logic is needed for unsubscribe, otherwise we just reset filter
          if (msg.vehicle_ids) {
             const current = clientData.vehicleFilter || [];
             broadcaster.updateFilter(clientData, { 
               vehicle_ids: current.filter(id => !msg.vehicle_ids.includes(id))
             });
          } else {
             broadcaster.updateFilter(clientData, { vehicle_ids: null });
          }
        }
      } catch (err) {
        // ignore malformed messages
      }
    });
  });

  // Admin websocket endpoint
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const handleAuth = async (token) => {
      try {
        const decoded = await fastify.jwt.verify(token);
        if (decoded.role !== 'admin') {
          throw new Error('Unauthorized');
        }
        broadcaster.addClient(socket, { isAdmin: true });
        socket.send(JSON.stringify({ event: 'auth:success' }));
        return true;
      } catch (err) {
        socket.send(JSON.stringify({ event: 'error', message: 'Unauthorized' }));
        socket.close(4401, 'Unauthorized');
        return false;
      }
    };

    // Check query token
    const queryToken = req.query.token;
    let authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      authHeader = authHeader.substring(7);
    }
    const token = queryToken || authHeader;

    if (token) {
      handleAuth(token).then(authed => {
        if (!authed) return;
      });
    } else {
      // Allow auth via message
      socket.on('message', async (message) => {
        try {
          const msg = JSON.parse(message.toString());
          if (msg.action === 'auth' && msg.token) {
            await handleAuth(msg.token);
          }
        } catch (err) {
          // ignore
        }
      });
      // Optionally timeout if no auth after some time, but task doesn't strictly require
    }
  });
}

export default fp(websocketPlugin, {
  name: 'websocket-plugin'
});
