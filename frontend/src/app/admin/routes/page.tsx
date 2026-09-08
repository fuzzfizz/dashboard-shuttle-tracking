'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Route, Vehicle } from '@/lib/types';
import { Navigation, MapPin, Bus, Plus, CheckCircle2, XCircle, Search, RefreshCw, Layers } from 'lucide-react';

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  const fetchRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      const [routesRes, vehiclesRes] = await Promise.all([
        api.routes.list(),
        api.vehicles.list()
      ]);
      setRoutes(routesRes || []);
      setVehicles(vehiclesRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const filteredRoutes = routes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getVehiclesOnRoute = (routeId: string) => {
    return vehicles.filter(v => v.current_route_id === routeId);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            เส้นทางเดินรถ (Route Management)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            จัดการและตรวจสอบเส้นทางรถรับ-ส่ง จุดจอด และรถประจำสาย
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchRoutes}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>รีเฟรช</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-xl text-xs sm:text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="ค้นหาชื่อเส้นทาง หรือคำอธิบาย..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50/50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>
        <div className="text-xs font-medium text-slate-500 hidden sm:block">
          ทั้งหมด <strong className="text-slate-900">{routes.length}</strong> เส้นทาง
        </div>
      </div>

      {/* Routes Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">กำลังโหลดข้อมูลเส้นทาง...</div>
      ) : filteredRoutes.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200/80 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Layers className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">ไม่พบเส้นทางเดินรถ</p>
          <p className="text-xs text-slate-400 mt-1">ยังไม่มีเส้นทางที่ตรงกับเงื่อนไขการค้นหา</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoutes.map((route) => {
            const assignedVehicles = getVehiclesOnRoute(route.id);
            const stopsCount = route.stops?.length || 0;

            return (
              <div
                key={route.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top line with color badge and status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-2xs ring-2 ring-white"
                        style={{ backgroundColor: route.color || '#3b82f6' }}
                      />
                      <h3 className="font-bold text-base text-slate-900">
                        {route.name}
                      </h3>
                    </div>

                    <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                      route.is_active !== false
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {route.is_active !== false ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>เปิดใช้งาน</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-400" />
                          <span>ปิดการใช้งาน</span>
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                    {route.description || 'ไม่มีคำอธิบายรายละเอียดเส้นทาง'}
                  </p>

                  {/* Stat Chips */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-[11px] text-slate-400">จุดจอดรับ-ส่ง</div>
                        <div className="text-sm font-bold text-slate-800 tabular-nums">
                          {stopsCount} จุด
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                      <Bus className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="text-[11px] text-slate-400">รถประจำสาย</div>
                        <div className="text-sm font-bold text-slate-800 tabular-nums">
                          {assignedVehicles.length} คัน
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {assignedVehicles.slice(0, 3).map((v) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 border-2 border-white text-[10px] font-bold text-blue-700"
                        title={v.plate_number}
                      >
                        {v.plate_number.slice(-2)}
                      </span>
                    ))}
                    {assignedVehicles.length > 3 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 border-2 border-white text-[10px] font-semibold text-slate-600">
                        +{assignedVehicles.length - 3}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedRoute(route)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    ดูจุดจอด (Stops) →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Route Stops Detail Modal */}
      {selectedRoute && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: selectedRoute.color || '#3b82f6' }}
                />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedRoute.name}</h2>
                  <p className="text-xs text-slate-500">{selectedRoute.description || 'ไม่มีคำอธิบาย'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRoute(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                ลำดับจุดจอดรับ-ส่ง (Stops Order)
              </h3>

              {!selectedRoute.stops || selectedRoute.stops.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">ยังไม่มีการกำหนดจุดจอดสำหรับเส้นทางนี้</p>
              ) : (
                <div className="space-y-2.5">
                  {selectedRoute.stops
                    .sort((a, b) => a.stop_order - b.stop_order)
                    .map((stop, index) => (
                      <div
                        key={stop.id || index}
                        className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            {stop.stop_order ?? index + 1}
                          </span>
                          <div>
                            <span className="text-xs sm:text-sm font-semibold text-slate-800">
                              {stop.name}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-mono">
                              {stop.lat?.toFixed(5)}, {stop.lng?.toFixed(5)}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200/60 tabular-nums">
                          รัศมี {stop.radius_meters || 50}m
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedRoute(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
