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
    const map: Record<string, string> = {
      'in_transit': 'bg-green-100 text-green-800',
      'idle': 'bg-yellow-100 text-yellow-800',
      'offline': 'bg-gray-100 text-gray-800',
    };
    const color = map[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{status}</span>;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicle Management</h1>
          <p className="text-sm text-gray-500">Total Vehicles: {vehicles.length}</p>
        </div>
        <button
          onClick={() => { setSelectedVehicle(null); setIsVehicleModalOpen(true); }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vehicle
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search plate or model..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={routeFilter}
          onChange={e => setRouteFilter(e.target.value)}
          className="border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Routes</option>
          <option value="unassigned">Unassigned</option>
          {routes.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="in_transit">In Transit</option>
          <option value="idle">Idle</option>
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-md mb-6">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">Plate Number</th>
                <th className="px-4 py-3 font-medium text-gray-700">Model</th>
                <th className="px-4 py-3 font-medium text-gray-700">Assigned Route</th>
                <th className="px-4 py-3 font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 font-medium text-gray-700">Device API Key</th>
                <th className="px-4 py-3 font-medium text-gray-700">Last Seen</th>
                <th className="px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : filteredVehicles.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No vehicles found.</td></tr>
              ) : (
                filteredVehicles.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
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
