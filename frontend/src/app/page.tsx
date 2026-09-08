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

    const unsubTripStarted = publicWs.subscribe('trip:started', (payload) => {
      setVehicles(prev => {
        const index = prev.findIndex(v => v.id === payload.vehicle_id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...next[index], status: 'in_transit' };
        return next;
      });
    });

    const unsubTripCompleted = publicWs.subscribe('trip:completed', (payload) => {
      setVehicles(prev => {
        const index = prev.findIndex(v => v.id === payload.vehicle_id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...next[index], status: 'idle' };
        return next;
      });
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubError();
      unsubLocation();
      unsubStatus();
      unsubTripStarted();
      unsubTripCompleted();
      publicWs.disconnect();
    };
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filteredVehicles = filterVehicles(vehicles, selectedRouteId, searchQuery);

  const activeVehiclesCount = vehicles.filter(v => v.status === 'in_transit').length;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-1.5 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden transition-colors"
            aria-label="Toggle vehicles menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-sm shadow-blue-500/20">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                Shuttle Live Tracker
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                ระบบติดตามพิกัดรถรับ-ส่งแบบเรียลไทม์
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Active Fleet Counter Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>กำลังวิ่ง: <strong className="text-slate-900 font-semibold">{activeVehiclesCount}</strong> / {vehicles.length} คัน</span>
          </div>

          {/* Connection Status Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-slate-600">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>{isConnected ? 'Live Sync' : 'Disconnected'}</span>
          </div>

          {/* Admin Portal Button */}
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-slate-800 active:bg-slate-950 transition-all shadow-xs"
          >
            <LayoutDashboard className="w-4 h-4 text-slate-300" />
            <span className="hidden sm:inline">Admin Portal</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:relative inset-y-0 left-0 z-40 md:z-10
            w-80 sm:w-88 bg-white border-r border-slate-200/90
            flex flex-col shrink-0 shadow-xl md:shadow-none
            transform transition-transform duration-200 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          {/* Filters Area */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3.5 shrink-0">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  สายรถ (Route)
                </label>
                <span className="text-xs text-slate-500">
                  {routes.length} เส้นทาง
                </span>
              </div>
              <select
                value={selectedRouteId || 'all'}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl py-2 px-3 text-xs sm:text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              >
                <option value="all">ทุกเส้นทาง (All Routes)</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="ค้นหาทะเบียนรถ เช่น AB-1234..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-500 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredVehicles.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Bus className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">ไม่พบรถตามตัวกรอง</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  ลองเปลี่ยนคำค้นหา หรือเลือกดูทุกเส้นทาง
                </p>
                {(selectedRouteId !== 'all' || searchQuery) && (
                  <button
                    onClick={() => { setSelectedRouteId('all'); setSearchQuery(''); }}
                    className="mt-4 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    รีเซ็ตตัวกรองทั้งหมด
                  </button>
                )}
              </div>
            ) : (
              filteredVehicles.map(vehicle => {
                const isSelected = selectedVehicleId === vehicle.id;
                const route = routes.find(r => r.id === vehicle.current_route_id);

                return (
                  <div
                    key={vehicle.id}
                    onClick={() => {
                      setSelectedVehicleId(vehicle.id);
                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          <Bus className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-slate-900 leading-none">
                            {vehicle.plate_number}
                          </span>
                          <span className="block text-xs text-slate-500 mt-0.5">
                            {vehicle.model || 'รถรับส่งทั่วไป'}
                          </span>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        vehicle.status === 'in_transit'
                          ? 'bg-emerald-100/80 text-emerald-800'
                          : vehicle.status === 'idle'
                          ? 'bg-amber-100/80 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          vehicle.status === 'in_transit'
                            ? 'bg-emerald-500'
                            : vehicle.status === 'idle'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`} />
                        {vehicle.status === 'in_transit' ? 'กำลังวิ่ง' : vehicle.status === 'idle' ? 'จอดรอ' : 'ออฟไลน์'}
                      </span>
                    </div>

                    {/* Route Info */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: route?.color || '#3b82f6' }} />
                      <span className="truncate">{route?.name || 'ยังไม่กำหนดสาย'}</span>
                    </div>

                    {/* Speed & Last Update */}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 font-mono">
                      <span className="tabular-nums font-medium text-slate-700">
                        {formatSpeed(vehicle.last_speed)}
                      </span>
                      <span className="tabular-nums">
                        {vehicle.last_seen_at ? new Date(vehicle.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ไม่ระบุเวลา'}
                      </span>
                    </div>
                  </div>
                );
              })
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

          {/* Floating Mobile Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden absolute bottom-5 left-4 z-20 flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 backdrop-blur-md text-white rounded-full shadow-lg text-xs font-semibold hover:bg-slate-900 transition-transform active:scale-95"
          >
            <Bus className="w-4 h-4" />
            <span>ดูรายการรถ ({filteredVehicles.length})</span>
          </button>
        </main>
      </div>
    </div>
  );
}
