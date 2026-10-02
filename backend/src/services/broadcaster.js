import crypto from 'node:crypto';

class BroadcasterService {
  constructor(redisClient = null) {
    this.clients = new Set();
    this.redis = redisClient;
    this.instanceId = crypto.randomUUID();
    this.channel = 'fleet:broadcast';

    this._setupRedisSubscription();
  }

  _setupRedisSubscription() {
    if (!this.redis?.sub) return;

    try {
      this.redis.sub.subscribe(this.channel).catch(() => {});
      this.redis.sub.on('message', (ch, msgStr) => {
        if (ch !== this.channel) return;
        try {
          const { instanceId, event, payload } = JSON.parse(msgStr);
          // Deduplicate if from this instance
          if (instanceId && instanceId === this.instanceId) return;
          this._broadcastLocal(event, payload);
        } catch {
          // ignore corrupted messages
        }
      });
    } catch {
      // ignore
    }
  }

  addClient(socket, { isAdmin = false, vehicleFilter = null } = {}) {
    const clientData = { socket, isAdmin, vehicleFilter };
    this.clients.add(clientData);

    socket.on('close', () => {
      this.removeClient(clientData);
    });

    socket.on('error', () => {
      this.removeClient(clientData);
    });

    return clientData;
  }

  removeClient(clientData) {
    this.clients.delete(clientData);
  }

  updateFilter(clientData, { vehicle_ids }) {
    if (clientData) {
      clientData.vehicleFilter = Array.isArray(vehicle_ids) ? vehicle_ids : null;
    }
  }

  _getFilterForEvent(event, payload) {
    return (client) => {
      if (client.isAdmin) return true;
      if (event === 'command:response') return client.isAdmin;
      if (client.vehicleFilter && client.vehicleFilter.length > 0) {
        const vehicleId = payload?.vehicle_id;
        return vehicleId !== undefined ? client.vehicleFilter.includes(vehicleId) : true;
      }
      return true;
    };
  }

  _broadcastLocal(event, payload, filterFn = null) {
    const message = JSON.stringify({ event, data: payload });
    const effectiveFilter = filterFn || this._getFilterForEvent(event, payload);

    for (const client of this.clients) {
      if (client.socket.readyState === 1) { // 1 = OPEN
        if (!effectiveFilter || effectiveFilter(client)) {
          client.socket.send(message);
        }
      } else if (client.socket.readyState > 1) { // CLOSING or CLOSED
        this.removeClient(client);
      }
    }
  }

  _broadcast(event, payload, filterFn = null) {
    // 1. Send locally immediately
    this._broadcastLocal(event, payload, filterFn);

    // 2. Publish to Redis for other backend instances
    if (this.redis?.isReady?.() && this.redis.pub) {
      try {
        const msg = JSON.stringify({
          instanceId: this.instanceId,
          event,
          payload,
        });
        this.redis.pub.publish(this.channel, msg).catch(() => {});
      } catch {
        // ignore publish error
      }
    }
  }

  broadcastLocation(locationData) {
    this._broadcast('vehicle:location', locationData, (client) => {
      if (client.isAdmin) return true;
      if (client.vehicleFilter && client.vehicleFilter.length > 0) {
        return client.vehicleFilter.includes(locationData.vehicle_id);
      }
      return true;
    });
  }

  broadcastStatus(statusData) {
    this._broadcast('vehicle:status', statusData, (client) => {
      if (client.isAdmin) return true;
      if (client.vehicleFilter && client.vehicleFilter.length > 0) {
        return client.vehicleFilter.includes(statusData.vehicle_id);
      }
      return true;
    });
  }

  broadcastTripEvent(eventName, tripData) {
    this._broadcast(eventName, tripData, (client) => {
      if (client.isAdmin) return true;
      if (client.vehicleFilter && client.vehicleFilter.length > 0) {
        return client.vehicleFilter.includes(tripData.vehicle_id);
      }
      return true;
    });
  }

  broadcastCommandResponse(commandData) {
    this._broadcast('command:response', commandData, (client) => client.isAdmin);
  }
}

export default BroadcasterService;
