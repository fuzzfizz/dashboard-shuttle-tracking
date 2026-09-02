'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { publicWs } from '@/lib/ws';
import { Vehicle, Route } from '@/lib/types';
import { filterVehicles, updateVehicleLocation, formatSpeed } from '@/lib/utils';
import MapWrapper from '@/components/Map/MapWrapper';
import { Bus, Search, Map as MapIcon, Menu, Wifi, WifiOff, LayoutDashboard } from 'lucide-react';

export default function PublicLiveTrackingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    const fetchData = async () => {
      try {
        const [routesData, vehiclesData] = await Promise.all([
          api.listRoutes(),
          api.listVehicles()
        ]);
        setRoutes(routesData || []);
        setVehicles(vehiclesData || []);
      } catch (err) {
        console.error('Failed to fetch initial data', err);
      }
    };

    fetchData();

    // WebSocket setup
    publicWs.connect();

    const unsubConnected = publicWs.subscribe('connected', () => setIsConnected(true));
    const unsubDisconnected = publicWs.subscribe('disconnected', () => setIsConnected(false));
    const unsubError = publicWs.subscribe('error', () => setIsConnected(false));

    const unsubLocation = publicWs.subscribe('vehicle:location', (payload) => {
      setVehicles(prev => updateVehicleLocation(prev, payload));
    });

    const unsubStatus = publicWs.subscribe('vehicle:status', (payload) => {
      setVehicles(prev => {
        const index = prev.findIndex(v => v.id === payload.vehicle_id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...next[index], status: payload.status, last_seen_at: payload.last_seen_at };
        return next;
      });
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubError();
      unsubLocation();
      unsubStatus();
      publicWs.disconnect();
    };
  }, []);

  const filteredVehicles = filterVehicles(vehicles, selectedRouteId, searchQuery);

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Shuttle Live Tracker</h1>
          <h1 className="text-xl font-bold text-gray-900 sm:hidden">Tracker</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-sm font-medium">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-green-700 hidden sm:inline">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-red-700 hidden sm:inline">Disconnected</span>
              </>
            )}
          </div>
          <Link href="/login" className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Admin Portal</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col z-10 hidden md:flex shrink-0">
          <div className="p-4 border-b border-gray-100 flex flex-col gap-4 shrink-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
              <select 
                value={selectedRouteId || 'all'} 
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="all">All Routes</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search plate number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredVehicles.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                No vehicles found for selected filters.
              </div>
            ) : (
              filteredVehicles.map(vehicle => (
                <div 
                  key={vehicle.id}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                  className={`p-3 mb-2 rounded-lg border cursor-pointer transition-colors ${selectedVehicleId === vehicle.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-900">{vehicle.plate_number}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      vehicle.status === 'in_transit' ? 'bg-green-100 text-green-800' :
                      vehicle.status === 'idle' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {vehicle.status === 'in_transit' ? 'In Transit' : vehicle.status === 'idle' ? 'Idle' : 'Offline'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    Route: {routes.find(r => r.id === vehicle.current_route_id)?.name || 'N/A'}
                  </div>
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
                    <span>Speed: {formatSpeed(vehicle.last_speed)}</span>
                    <span>{vehicle.last_seen_at ? new Date(vehicle.last_seen_at).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Map Area */}
        <main className="flex-1 relative z-0">
          <MapWrapper 
            vehicles={vehicles}
            routes={routes}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={(id) => setSelectedVehicleId(id)}
          />
        </main>
      </div>
    </div>
  );
}
