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

  const getRouteName = (routeId: string | null) => {
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

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
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

      {/* Main Map & Table Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Live Table */}
        <div className="lg:col-span-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <h2 className="font-semibold text-slate-800">Live Fleet</h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search plate or route..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="w-full sm:w-auto px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="in_transit">In Transit</option>
                <option value="idle">Idle</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-medium">Vehicle</th>
                  <th className="px-4 py-3 font-medium">Status / Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map((v) => (
                    <tr 
                      key={v.id} 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => handleVehicleClick(v.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{v.plate_number}</div>
                        <div className="text-xs text-slate-500">{v.model}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{formatSpeed(v.last_speed)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="mb-1">{getStatusBadge(v.status)}</div>
                        <div className="text-xs text-slate-600 truncate max-w-[150px]" title={getRouteName(v.current_route_id)}>
                          {getRouteName(v.current_route_id)}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-500">
                      No vehicles match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Embedded Map */}
        <div className="lg:col-span-2 bg-slate-200 rounded-xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[400px]">
          <MapWrapper
            vehicles={vehicles}
            routes={routes}
            selectedVehicleId={selectedVehicleId}
            onVehicleClick={handleVehicleClick}
          />
        </div>
      </div>
    </div>
  );
}
