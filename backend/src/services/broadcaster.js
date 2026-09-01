class BroadcasterService {
  constructor() {
    this.clients = new Set();
  }

  addClient(socket, { isAdmin = false, vehicleFilter = null } = {}) {
    const clientData = { socket, isAdmin, vehicleFilter };
    this.clients.add(clientData);

    socket.on('close', () => {
      this.removeClient(clientData);
    });
    
    // In fastify-websocket, it's a standard ws instance or something similar
    // we also handle socket error if needed
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

  _broadcast(event, payload, filterFn = null) {
    const message = JSON.stringify({ event, data: payload });
    for (const client of this.clients) {
      if (client.socket.readyState === 1) { // 1 = OPEN
        if (!filterFn || filterFn(client)) {
          client.socket.send(message);
        }
      } else if (client.socket.readyState > 1) { // CLOSING or CLOSED
        this.removeClient(client);
      }
    }
  }

  broadcastLocation(locationData) {
    this._broadcast('vehicle:location', locationData, (client) => {
      if (client.isAdmin) return true;
      if (client.vehicleFilter && client.vehicleFilter.length > 0) {
        return client.vehicleFilter.includes(locationData.vehicle_id);
      }
      return true; // if no filter, receive all
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
    // e.g. 'trip:started', 'trip:completed'
    this._broadcast(eventName, tripData, (client) => {
      if (client.isAdmin) return true;
      // depending on requirement, public might not receive trip events or only for filtered vehicle
      if (client.vehicleFilter && client.vehicleFilter.length > 0) {
        return client.vehicleFilter.includes(tripData.vehicle_id);
      }
      return true;
    });
  }

  broadcastCommandResponse(commandData) {
    // only admin
    this._broadcast('command:response', commandData, (client) => client.isAdmin);
  }
}

export default BroadcasterService;
