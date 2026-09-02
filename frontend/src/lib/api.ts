import type { User, Vehicle, Route, Trip, DailyReportSummary, AuthResponse, ApiResponse, GpsPoint } from './types';

export class ApiError extends Error {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    if (process.env.NEXT_PUBLIC_API_URL) {
      this.baseUrl = process.env.NEXT_PUBLIC_API_URL;
    } else if (typeof window !== 'undefined' && window.location?.hostname) {
      const protocol = window.location.protocol || 'http:';
      const host = window.location.hostname;
      this.baseUrl = `${protocol}//${host}:3000/api/v1`;
    } else {
      this.baseUrl = 'http://localhost:3000/api/v1';
    }
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setAuthToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  getAuthToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(data.error || data.message || 'API request failed', response.status);
      }
      
      if (!data.success && data.error) {
         throw new ApiError(data.error, response.status);
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }

  // Auth
  async login(username: string, password: string):Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: username, username, password }),
    });
  }
  
  async getProfile():Promise<User> {
     return this.request<User>('/auth/me');
  }

  logout() {
    this.setAuthToken(null);
  }

  // Vehicles
  async listVehicles(params?: Record<string, string>):Promise<Vehicle[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<Vehicle[]>(`/vehicles${query}`);
  }

  async getVehicle(id: string):Promise<Vehicle> {
    return this.request<Vehicle>(`/vehicles/${id}`);
  }

  async createVehicle(data: Partial<Vehicle>):Promise<Vehicle> {
    return this.request<Vehicle>('/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVehicle(id: string, data: Partial<Vehicle>):Promise<Vehicle> {
    return this.request<Vehicle>(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVehicle(id: string):Promise<void> {
    return this.request<void>(`/vehicles/${id}`, { method: 'DELETE' });
  }

  async sendCommand(id: string, command: string, params: any = {}):Promise<any> {
    return this.request<any>(`/vehicles/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ command, params }),
    });
  }

  // Trips
  async listTrips(params?: Record<string, string>):Promise<Trip[]> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    return this.request<Trip[]>(`/trips${query}`);
  }

  async getTrip(id: string):Promise<Trip> {
    return this.request<Trip>(`/trips/${id}`);
  }
  
  async getTripTrack(id: string):Promise<GpsPoint[]> {
     return this.request<GpsPoint[]>(`/trips/${id}/track`);
  }

  // Routes
  async listRoutes():Promise<Route[]> {
    return this.request<Route[]>('/routes');
  }

  async getRoute(id: string):Promise<Route> {
    return this.request<Route>(`/routes/${id}`);
  }

  async createRoute(data: Partial<Route>):Promise<Route> {
    return this.request<Route>('/routes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRoute(id: string, data: Partial<Route>):Promise<Route> {
    return this.request<Route>(`/routes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRoute(id: string):Promise<void> {
    return this.request<void>(`/routes/${id}`, { method: 'DELETE' });
  }

  // Reports
  async getDailyReport(params: { date?: string, start_date?: string, end_date?: string, vehicle_id?: string }):Promise<DailyReportSummary[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<DailyReportSummary[]>(`/reports/daily?${query}`);
  }

  // Namespaced accessors
  public auth = {
    login: (username: string, password: string) => this.login(username, password),
    getProfile: () => this.getProfile(),
    logout: () => this.logout(),
  };

  public vehicles = {
    list: (params?: Record<string, string>) => this.listVehicles(params),
    get: (id: string) => this.getVehicle(id),
    create: (data: Partial<Vehicle>) => this.createVehicle(data),
    update: (id: string, data: Partial<Vehicle>) => this.updateVehicle(id, data),
    delete: (id: string) => this.deleteVehicle(id),
    sendCommand: (id: string, command: string, params: any = {}) => this.sendCommand(id, command, params),
  };

  public trips = {
    list: (params?: Record<string, string>) => this.listTrips(params),
    get: (id: string) => this.getTrip(id),
    getTrack: (id: string) => this.getTripTrack(id),
  };

  public routes = {
    list: () => this.listRoutes(),
    get: (id: string) => this.getRoute(id),
    create: (data: Partial<Route>) => this.createRoute(data),
    update: (id: string, data: Partial<Route>) => this.updateRoute(id, data),
    delete: (id: string) => this.deleteRoute(id),
  };

  public reports = {
    getDaily: (params: { date?: string, start_date?: string, end_date?: string, vehicle_id?: string }) => this.getDailyReport(params),
  };
}

export const api = new ApiClient();

