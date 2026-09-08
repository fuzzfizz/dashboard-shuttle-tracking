"use client";

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { adminWs } from '@/lib/ws';
import type { Vehicle, Route, VehicleStatusPayload } from '@/lib/types';
import { filterVehicles, maskApiKey } from '@/lib/vehicle-utils';
import VehicleModal from '@/components/Vehicles/VehicleModal';
import CommandModal from '@/components/Vehicles/CommandModal';
import { Plus, Search, Edit2, Trash2, Terminal, Copy, Check } from 'lucide-react';

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [routeFilter, setRouteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();

    // WebSocket for live status updates
    if (!adminWs.isConnected()) {
      adminWs.connect();
    }

    const unsubStatus = adminWs.subscribe('vehicle:status', (data: VehicleStatusPayload) => {
      setVehicles(prev => prev.map(v => 
        v.id === data.vehicle_id 
          ? { ...v, status: data.status, last_seen_at: data.last_seen_at || v.last_seen_at } 
          : v
      ));
    });

    return () => {
      unsubStatus();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vData, rData] = await Promise.all([
        api.vehicles.list(),
        api.routes.list()
      ]);
      setVehicles(vData);
      setRoutes(rData);
      
      // Subscribe to all vehicles
      if (vData.length > 0) {
        adminWs.subscribeVehicles(vData.map(v => v.id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleDelete = async (vehicle: Vehicle) => {
    if (confirm(`Are you sure you want to delete vehicle ${vehicle.plate_number}?`)) {
      try {
        await api.vehicles.delete(vehicle.id);
        setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
      } catch (err: any) {
        alert(err.message || 'Failed to delete vehicle');
      }
    }
  };

  const filteredVehicles = filterVehicles(vehicles, searchQuery, routeFilter, statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            กำลังวิ่ง (In Transit)
          </span>
        );
      case 'idle':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            จอดรอ (Idle)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            ออฟไลน์ (Offline)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            จัดการยานพาหนะ (Vehicle Fleet)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ลงทะเบียนรถรับ-ส่ง จัดการสายที่สังกัด Device API Key และส่งคำสั่งควบคุมระยะไกล
          </p>
        </div>
        <button
          onClick={() => { setSelectedVehicle(null); setIsVehicleModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:bg-blue-800 text-xs sm:text-sm font-semibold transition-all shadow-xs shadow-blue-600/20 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มรถใหม่ (Add Vehicle)</span>
        </button>
      </div>

      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3.5">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-2.5 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="ค้นหาทะเบียน หรือรุ่นรถ..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50/50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>
        <select
          value={routeFilter}
          onChange={e => setRouteFilter(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all min-w-[150px]"
        >
          <option value="all">ทุกเส้นทาง (All Routes)</option>
          <option value="unassigned">ยังไม่กำหนดสาย</option>
          {routes.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all min-w-[130px]"
        >
          <option value="all">ทุกสถานะ (All Status)</option>
          <option value="online">ออนไลน์ (Online)</option>
          <option value="offline">ออฟไลน์ (Offline)</option>
          <option value="in_transit">กำลังวิ่ง (In Transit)</option>
          <option value="idle">จอดรอ (Idle)</option>
        </select>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs sm:text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">ทะเบียนรถ</th>
                <th className="py-3.5 px-4">รุ่นรถ</th>
                <th className="py-3.5 px-4">สายที่สังกัด</th>
                <th className="py-3.5 px-4">สถานะ</th>
                <th className="py-3.5 px-4">Device API Key</th>
                <th className="py-3.5 px-4">พิกัดล่าสุด</th>
                <th className="py-3.5 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">กำลังโหลดรายชื่อรถ...</td></tr>
              ) : filteredVehicles.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">ไม่พบรถที่ตรงกับเงื่อนไขการค้นหา</td></tr>
              ) : (
                filteredVehicles.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-medium">{v.plate_number}</td>
                    <td className="px-4 py-3 text-gray-600">{v.model || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {v.current_route_id ? routes.find(r => r.id === v.current_route_id)?.name || 'Unknown' : 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(v.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">
                          {maskApiKey(v.device_api_key)}
                        </code>
                        {v.device_api_key && (
                          <button
                            onClick={() => handleCopyKey(v.device_api_key!, v.id)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy Key"
                          >
                            {copiedKeyId === v.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {v.last_seen_at ? new Date(v.last_seen_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => { setSelectedVehicle(v); setIsVehicleModalOpen(true); }}
                          className="p-1 text-gray-500 hover:text-blue-600 transition"
                          title="Edit Vehicle"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => { setSelectedVehicle(v); setIsCommandModalOpen(true); }}
                          className="p-1 text-gray-500 hover:text-indigo-600 transition"
                          title="Remote Command"
                        >
                          <Terminal size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1 text-gray-500 hover:text-red-600 transition"
                          title="Delete Vehicle"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VehicleModal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        vehicle={selectedVehicle}
        routes={routes}
        onSuccess={(savedVehicle, isNew) => {
          if (isNew) {
            setVehicles(prev => [...prev, savedVehicle]);
            if (savedVehicle.device_api_key) {
               adminWs.subscribeVehicles([savedVehicle.id]);
            }
          } else {
            setVehicles(prev => prev.map(v => v.id === savedVehicle.id ? savedVehicle : v));
            setIsVehicleModalOpen(false);
          }
        }}
      />

      <CommandModal
        isOpen={isCommandModalOpen}
        onClose={() => setIsCommandModalOpen(false)}
        vehicle={selectedVehicle}
      />
    </div>
  );
}
