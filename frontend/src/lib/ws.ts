export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private token: string | null = null;
  private isPublic: boolean;
  private intentionalDisconnect = false;

  constructor(isPublic = false) {
    this.isPublic = isPublic;
    let baseUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!baseUrl) {
      if (typeof window !== 'undefined' && window.location?.hostname) {
        const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        baseUrl = `${wsProto}//${window.location.hostname}:3000`;
      } else {
        baseUrl = 'ws://localhost:3000';
      }
    }
    this.url = isPublic ? `${baseUrl}/ws/public` : `${baseUrl}/ws`;
    if (typeof window !== 'undefined' && !isPublic) {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
      this.token = token;
  }

  connect() {
    if (typeof window === 'undefined') return;
    this.intentionalDisconnect = false;

    let finalUrl = this.url;
    if (!this.isPublic && this.token) {
        finalUrl += `?token=${this.token}`;
    }

    this.ws = new WebSocket(finalUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected', null);
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event) {
          this.emit(parsed.event, parsed.data !== undefined ? parsed.data : parsed.payload);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message', e);
      }
    };

    this.ws.onclose = () => {
      this.emit('disconnected', null);
      if (!this.intentionalDisconnect) {
          this.reconnect();
      }
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max WebSocket reconnect attempts reached');
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, timeout);
  }

  disconnect() {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === 1; // 1 is OPEN
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  send(action: string, payload: any = {}) {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ action, payload }));
    } else {
        console.warn('WebSocket not connected, cannot send message', action);
    }
  }

  subscribeVehicles(vehicle_ids: string[]) {
    this.send('subscribe', { vehicles: vehicle_ids });
  }

  unsubscribeVehicles(vehicle_ids: string[]) {
    this.send('unsubscribe', { vehicles: vehicle_ids });
  }

  ping() {
    this.send('ping');
  }
}

export const publicWs = new WebSocketClient(true);
export const adminWs = new WebSocketClient(false);
