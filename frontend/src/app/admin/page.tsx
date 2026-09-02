'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Bus, Navigation, Activity, ArrowUpRight, Search } from 'lucide-react';
import { StatsCard } from '@/components/UI/StatsCard';
import MapWrapper from '@/components/Map/MapWrapper';
import { api } from '@/lib/api';
import { adminWs } from '@/lib/ws';
import { Vehicle, Route, Trip, DailyReportSummary } from '@/lib/types';
import { computeFleetStats, filterAdminVehicles } from '@/lib/admin-utils';
import { updateVehicleLocation, formatSpeed } from '@/lib/utils';

export default function AdminDashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [vehiclesRes, routesRes, tripsRes, reportsRes] = await Promise.all([
          api.vehicles.list(),
          api.routes.list(),
          api.trips.list(),
          api.reports.getDaily({ date: new Date().toISOString().split('T')[0] })
        ]);

        setVehicles(vehiclesRes);
        setRoutes(routesRes);
        setTrips(tripsRes);
        setDailyReports(reportsRes);
      } catch (error) {
        console.error('Error loading admin dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Set up WebSocket subscriptions
  useEffect(() => {
    const unsubLocation = adminWs.subscribe('vehicle:location', (payload) => {
      setVehicles((prev) => updateVehicleLocation(prev, payload));
    });

    const unsubStatus = adminWs.subscribe('vehicle:status', (payload) => {
      setVehicles((prev) => {
        const idx = prev.findIndex(v => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: payload.status, last_seen_at: payload.last_seen_at || new Date().toISOString() };
        return next;
      });
    });

    const unsubTripStarted = adminWs.subscribe('trip:started', (payload) => {
      setTrips(prev => [...prev, payload]);
      setVehicles(prev => {
        const idx = prev.findIndex(v => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'in_transit' };
        return next;
      });
    });

    const unsubTripCompleted = adminWs.subscribe('trip:completed', (payload) => {
      setTrips(prev => prev.map(t => t.id === payload.trip_id ? { ...t, status: 'completed' } : t));
      setVehicles(prev => {
        const idx = prev.findIndex(v => v.id === payload.vehicle_id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'idle' };
        return next;
      });
    });

    return () => {
      unsubLocation();
      unsubStatus();
      unsubTripStarted();
      unsubTripCompleted();
    };
  }, []);

  const stats = React.useMemo(
    () => computeFleetStats(vehicles, trips, dailyReports),
    [vehicles, trips, dailyReports]
  );

  const filteredVehicles = React.useMemo(
    () => filterAdminVehicles(vehicles, searchQuery, statusFilter),
    [vehicles, searchQuery, statusFilter]
  );

  const handleVehicleClick = useCallback((id: string) => {
    setSelectedVehicleId(id);
  }, []);

  const getRouteName = (routeId?: string | null) => {
    if (!routeId) return 'Unassigned';
    return routes.find(r => r.id === routeId)?.name || 'Unknown Route';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_transit': return <span className="px-2.5 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">In Transit</span>;
      case 'idle': return <span className="px-2.5 py-1 text-xs rounded-full bg-amber-100 text-amber-800 font-medium">Idle</span>;
      default: return <span className="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-800 font-medium">Offline</span>;
    }
  };

  const getVehicleTodayDistance = (vehicleId: string) => {
    const report = dailyReports.find(r => r.vehicle_id === vehicleId);
    return report ? `${Number(report.total_distance_km || 0).toFixed(1)} km` : '0.0 km';
  };

  const formatLastSeen = (timestamp?: string | null) => {
    if (!timestamp) return 'Never';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return <div className="p-6 text-slate-500 font-medium">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Fleet Status"
          value={`${stats.onlineCount} / ${stats.totalVehicles}`}
          subtext="Active Online / Total Fleet"
          icon={<Bus className="w-6 h-6" />}
          colorScheme="blue"
        />
        <StatsCard
          title="In Transit"
          value={stats.inTransitCount}
          subtext="Vehicles currently driving"
          icon={<Activity className="w-6 h-6" />}
          colorScheme="green"
        />
        <StatsCard
          title="Today's Mileage"
          value={`${stats.totalKmToday} km`}
          subtext="Total distance covered today"
          icon={<Navigation className="w-6 h-6" />}
          colorScheme="amber"
        />
        <StatsCard
          title="Active Trips"
          value={stats.activeTripsCount}
          subtext="Trips currently in progress"
          icon={<ArrowUpRight className="w-6 h-6" />}
          colorScheme="purple"
        />
      </div>

      {/* Fleet Live Map Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-slate-800">Fleet Live Map</h2>
            <p className="text-xs text-slate-500">Real-time GPS positions of all registered shuttle vehicles</p>
          </div>
          {selectedVehicleId && (
            <button
              onClick={() => setSelectedVehicleId(null)}
              className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 font-medium"
            >
              Reset Map View
            </button>
          )}
        </div>
        <div className="h-[420px] bg-slate-100 relative">
          <MapWrapper
            vehicles={vehicles}
            routes={routes}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={handleVehicleClick}
          />
        </div>
      </div>

      {/* Full 8-Column Live Fleet Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="font-semibold text-slate-800">Live Fleet Overview</h2>
            <p className="text-xs text-slate-500">Real-time status, telemetry, and daily mileage per vehicle</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search plate number or route..."
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="in_transit">In Transit</option>
              <option value="idle">Idle</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium">Plate Number</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Assigned Route</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Speed</th>
                <th className="px-4 py-3 font-medium">Today Distance</th>
                <th className="px-4 py-3 font-medium">Last Seen</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVehicles.length > 0 ? (
                filteredVehicles.map((v) => (
                  <tr
                    key={v.id}
                    className={`hover:bg-slate-50 transition-colors ${selectedVehicleId === v.id ? 'bg-blue-50/70' : ''}`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {v.plate_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {v.model || 'Standard Shuttle'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {getRouteName(v.current_route_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(v.status)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {formatSpeed(v.last_speed)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {getVehicleTodayDistance(v.id)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatLastSeen(v.last_seen_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          handleVehicleClick(v.id);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                        title="Focus on map"
                      >
                        <Bus className="w-3.5 h-3.5" />
                        Focus Map
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No vehicles found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

