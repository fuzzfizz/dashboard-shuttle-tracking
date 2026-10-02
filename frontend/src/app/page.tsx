'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/lib/api';
import { publicWs } from '@/lib/ws';
import { Vehicle, Route } from '@/lib/types';
import { filterFleet, updateVehicleLocation, formatSpeed, formatDistance } from '@/lib/utils';
import MapWrapper from '@/components/Map/MapWrapper';
import {
  Bus,
  Search,
  Activity,
  Navigation,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export default function MobileExecutiveFleetDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRouteId, setSelectedRouteId] = useState('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const mapSectionRef = useRef<HTMLDivElement>(null);

  // Fetch initial data
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        const [vehiclesRes, routesRes] = await Promise.all([
          api.listVehicles(),
          api.listRoutes()
        ]);
        if (isMounted) {
          setVehicles(vehiclesRes || []);
          setRoutes(routesRes || []);
        }
      } catch (err) {
        console.error('Failed to load fleet data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    // WebSocket Setup
    publicWs.connect();

    const unsubConnected = publicWs.subscribe('connected', () => setIsConnected(true));
    const unsubDisconnected = publicWs.subscribe('disconnected', () => setIsConnected(false));
    const unsubError = publicWs.subscribe('error', () => setIsConnected(false));

    const unsubLocation = publicWs.subscribe('vehicle:location', (payload) => {
      setVehicles((prev) => updateVehicleLocation(prev, payload));
    });

    const unsubStatus = publicWs.subscribe('vehicle:status', (payload) => {
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: payload.status,
          last_seen_at: payload.last_seen_at || new Date().toISOString()
        };
        return next;
      });
    });

    const unsubTripStarted = publicWs.subscribe('trip:started', (payload) => {
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'in_transit' };
        return next;
      });
    });

    const unsubTripCompleted = publicWs.subscribe('trip:completed', (payload) => {
      setVehicles((prev) => {
        const idx = prev.findIndex((v) => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'idle' };
        return next;
      });
    });

    return () => {
      isMounted = false;
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

  // Filtered vehicles
  const filteredVehicles = useMemo(
    () => filterFleet(vehicles, searchQuery, statusFilter, selectedRouteId),
    [vehicles, searchQuery, statusFilter, selectedRouteId]
  );

  // Fleet aggregate metrics
  const metrics = useMemo(() => {
    const total = vehicles.length;
    const inTransit = vehicles.filter((v) => v.status === 'in_transit').length;
    const idle = vehicles.filter((v) => v.status === 'idle').length;
    const totalKm = vehicles.reduce((sum, v) => sum + (Number(v.today_total_km) || 0), 0);

    return { total, inTransit, idle, totalKm: totalKm.toFixed(1) };
  }, [vehicles]);

  const handleSelectVehicle = (id: string) => {
    setSelectedVehicleId(id);
    if (mapSectionRef.current) {
      mapSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getRouteInfo = (vehicle: Vehicle) => {
    const routeId = vehicle.current_route_id || vehicle.route_id;
    return routes.find((r) => r.id === routeId);
  };

  const formatLastSeen = (timestamp?: string | null) => {
    if (!timestamp) return 'ไม่มีข้อมูล';
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-100">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Bus className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-900">
                  ระบบติดตามรถรับ-ส่ง
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-semibold bg-blue-50 text-blue-700 rounded-md border border-blue-200/60">
                  Live Fleet
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                ติดตามพิกัด เส้นทางเป้าหมาย และระยะทางการวิ่งแบบเรียลไทม์
              </p>
            </div>
          </div>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isConnected ? 'เชื่อมต่อสด' : 'รอการเชื่อมต่อ'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
        {/* 2. Aggregate Fleet Metric Badges */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500">รถทั้งหมด</span>
              <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
                {metrics.total} <span className="text-xs font-normal text-slate-500">คัน</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-emerald-700">กำลังวิ่ง</span>
              <div className="text-lg sm:text-xl font-bold text-emerald-600 font-mono">
                {metrics.inTransit} <span className="text-xs font-normal text-slate-500">คัน</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-amber-700">จอดรอ</span>
              <div className="text-lg sm:text-xl font-bold text-amber-600 font-mono">
                {metrics.idle} <span className="text-xs font-normal text-slate-500">คัน</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-blue-700">ระยะทางรวมวันนี้</span>
              <div className="text-lg sm:text-xl font-bold text-blue-900 font-mono">
                {metrics.totalKm} <span className="text-xs font-normal text-slate-500">กม.</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Main Fleet Live Map (Top Layout) */}
        <section ref={mapSectionRef} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                แผนที่แสดงตำแหน่งรถสด (Fleet Live Map)
              </h2>
            </div>
            {selectedVehicleId && (
              <button
                onClick={() => setSelectedVehicleId(null)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 bg-blue-50 rounded-lg transition-colors"
              >
                ดูรถทั้งหมด
              </button>
            )}
          </div>

          <div className="w-full h-[400px] sm:h-[500px] rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative bg-slate-100">
            <MapWrapper
              vehicles={vehicles}
              routes={routes}
              selectedVehicleId={selectedVehicleId}
              onVehicleClick={handleSelectVehicle}
              onResetFocus={() => setSelectedVehicleId(null)}
            />
          </div>
        </section>

        {/* 4. Controls & Filters */}
        <section className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาป้ายทะเบียน สายรถ หรือรุ่นรถ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Pills Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { key: 'all', label: 'ทั้งหมด' },
                { key: 'in_transit', label: 'กำลังวิ่ง' },
                { key: 'idle', label: 'จอดรอ' },
                { key: 'offline', label: 'ออฟไลน์' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === tab.key
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Mobile Cards View (< 768px) */}
        <section className="block md:hidden space-y-3">
          {filteredVehicles.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
              <Bus className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">ไม่พบรถตามเงื่อนไขที่เลือก</p>
              <p className="text-xs">ลองค้นหาด้วยคำใหม่ หรือเลือกตัวกรองสถานะทั้งหมด</p>
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const route = getRouteInfo(vehicle);
              const isSelected = vehicle.id === selectedVehicleId;

              return (
                <div
                  key={vehicle.id}
                  onClick={() => handleSelectVehicle(vehicle.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white border-slate-200/90 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <Bus className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-base text-slate-900 leading-tight block">
                          {vehicle.plate_number}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {vehicle.model || 'รถรับส่งทั่วไป'}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      vehicle.status === 'in_transit'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : vehicle.status === 'idle'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
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

                  {/* Route & Target Destination */}
                  <div className="flex items-center gap-2 text-xs text-slate-700 mb-3 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: route?.color || '#3b82f6' }}
                    />
                    <span className="font-semibold truncate">
                      {route ? route.name : 'ยังไม่กำหนดสาย'}
                    </span>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">ความเร็วปัจจุบัน</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {formatSpeed(vehicle.last_speed)}
                      </span>
                    </div>

                    <div>
                      <span className="text-blue-600 font-medium block text-[11px]">ระยะทางวิ่งวันนี้</span>
                      <span className="font-mono font-bold text-blue-900 text-sm">
                        {formatDistance(vehicle.today_total_km)}
                      </span>
                    </div>
                  </div>

                  {/* Action Tap Button (>= 44px ergonomics) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectVehicle(vehicle.id);
                    }}
                    className={`w-full mt-3 h-11 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-98'
                    }`}
                  >
                    <span>ดูเส้นทาง & โฟกัสบนแผนที่</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </section>

        {/* 6. Desktop Executive Data Table (>= 768px) */}
        <section className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 text-xs font-semibold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">รถ / ป้ายทะเบียน</th>
                  <th className="px-5 py-3.5">สายรถที่สังกัด</th>
                  <th className="px-5 py-3.5">สถานะ</th>
                  <th className="px-5 py-3.5 font-mono">ความเร็ว</th>
                  <th className="px-5 py-3.5 font-mono text-blue-700">ระยะทางวันนี้</th>
                  <th className="px-5 py-3.5">อัปเดตล่าสุด</th>
                  <th className="px-5 py-3.5 text-right">แอ็กชัน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium">
                      ไม่พบข้อมูลรถตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle) => {
                    const route = getRouteInfo(vehicle);
                    const isSelected = vehicle.id === selectedVehicleId;

                    return (
                      <tr
                        key={vehicle.id}
                        onClick={() => handleSelectVehicle(vehicle.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/60 font-medium' : ''
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <Bus className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">
                                {vehicle.plate_number}
                              </span>
                              <span className="text-xs text-slate-500">
                                {vehicle.model || 'รถรับส่งทั่วไป'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: route?.color || '#94a3b8' }}
                            />
                            <span className="text-slate-800 font-medium">
                              {route ? route.name : 'ยังไม่กำหนดสาย'}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            vehicle.status === 'in_transit'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : vehicle.status === 'idle'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
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
                        </td>

                        <td className="px-5 py-4 font-mono font-medium text-slate-800">
                          {formatSpeed(vehicle.last_speed)}
                        </td>

                        <td className="px-5 py-4 font-mono font-bold text-blue-900">
                          {formatDistance(vehicle.today_total_km)}
                        </td>

                        <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                          {formatLastSeen(vehicle.last_seen_at)}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectVehicle(vehicle.id);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <span>ดูเส้นทาง</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
