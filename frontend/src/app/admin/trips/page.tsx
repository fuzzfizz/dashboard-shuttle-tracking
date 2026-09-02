'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { Trip, Vehicle, Route, GpsPoint } from '@/lib/types';
import { formatDuration, calculateTrackStats, filterTrips } from '@/lib/trip-utils';
import PlaybackMapWrapper from '@/components/Map/PlaybackMapWrapper';

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    vehicleId: '',
    routeId: '',
    status: 'All'
  });

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [track, setTrack] = useState<GpsPoint[]>([]);
  const [trackLoading, setTrackLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, vehiclesRes, routesRes] = await Promise.all([
        api.trips.list(),
        api.vehicles.list(),
        api.routes.list()
      ]);
      setTrips(tripsRes || []);
      setVehicles(vehiclesRes || []);
      setRoutes(routesRes || []);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = filterTrips(trips, filters);

  const openTrip = async (trip: Trip) => {
    setSelectedTrip(trip);
    setTrackLoading(true);
    setTrack([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    
    try {
      const res = await api.trips.getTrack(trip.id);
      if (res) {
        setTrack(res);
      }
    } catch (err) {
      console.error('Failed to fetch track', err);
    } finally {
      setTrackLoading(false);
    }
  };

  useEffect(() => {
    if (isPlaying && track.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= track.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, track]);

  const stats = calculateTrackStats(track);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Trip History</h1>
      
      <div className="bg-white p-4 rounded shadow mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input type="date" value={filters.date} onChange={e => setFilters({...filters, date: e.target.value})} className="border p-2 rounded w-40" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Vehicle</label>
          <select value={filters.vehicleId} onChange={e => setFilters({...filters, vehicleId: e.target.value})} className="border p-2 rounded w-48">
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate_number} ({v.model})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Route</label>
          <select value={filters.routeId} onChange={e => setFilters({...filters, routeId: e.target.value})} className="border p-2 rounded w-48">
            <option value="">All Routes</option>
            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="border p-2 rounded w-32">
            <option value="All">All</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Vehicle</th>
              <th className="p-3">Route</th>
              <th className="p-3">Start Time</th>
              <th className="p-3">End Time / Status</th>
              <th className="p-3">Duration</th>
              <th className="p-3">Distance</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-4 text-center">Loading...</td></tr>
            ) : filteredTrips.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">No trips found.</td></tr>
            ) : (
              filteredTrips.map(trip => {
                const vehicle = vehicles.find(v => v.id === trip.vehicle_id);
                const route = routes.find(r => r.id === trip.route_id);
                return (
                  <tr key={trip.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{vehicle ? `${vehicle.plate_number} (${vehicle.model})` : 'Unknown'}</td>
                    <td className="p-3">{route ? route.name : 'Unknown'}</td>
                    <td className="p-3">{new Date(trip.started_at).toLocaleString()}</td>
                    <td className="p-3">{trip.ended_at ? new Date(trip.ended_at).toLocaleString() : <span className="text-blue-500">{trip.status}</span>}</td>
                    <td className="p-3">{formatDuration(trip.started_at, trip.ended_at)}</td>
                    <td className="p-3">{(trip.total_distance_km || 0).toFixed(2)} km</td>
                    <td className="p-3">
                      <button onClick={() => openTrip(trip)} className="text-blue-600 hover:underline">Play Track / ดูเส้นทาง</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-50">
          <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-xl">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">Trip Playback</h2>
              <button onClick={() => setSelectedTrip(null)} className="text-gray-500 hover:text-black">Close &times;</button>
            </div>
            
            <div className="p-4 border-b bg-gray-50 grid grid-cols-5 gap-2 text-sm text-center">
              <div><div className="font-semibold text-gray-500">Distance</div><div>{stats.distanceKm} km</div></div>
              <div><div className="font-semibold text-gray-500">Duration</div><div>{formatDuration(selectedTrip.started_at, selectedTrip.ended_at)}</div></div>
              <div><div className="font-semibold text-gray-500">Points</div><div>{stats.totalPoints}</div></div>
              <div><div className="font-semibold text-gray-500">Max Speed</div><div>{stats.maxSpeedKmh} km/h</div></div>
              <div><div className="font-semibold text-gray-500">Avg Speed</div><div>{stats.avgSpeedKmh} km/h</div></div>
            </div>

            <div className="flex-grow relative">
              {trackLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">Loading track...</div>
              ) : track.length > 0 ? (
                <PlaybackMapWrapper 
                  track={track} 
                  currentIndex={currentIndex} 
                  vehiclePlate={vehicles.find(v => v.id === selectedTrip.vehicle_id)?.plate_number}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">No track data available.</div>
              )}
            </div>

            {track.length > 0 && (
              <div className="p-4 border-t bg-white">
                <div className="flex items-center gap-4 mb-2">
                  <button onClick={() => setIsPlaying(!isPlaying)} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 w-24">
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max={track.length - 1} 
                    value={currentIndex} 
                    onChange={e => {
                      setCurrentIndex(parseInt(e.target.value));
                      setIsPlaying(false);
                    }}
                    className="flex-grow"
                  />
                  <div className="text-sm font-mono">{new Date(track[currentIndex].timestamp).toLocaleTimeString()}</div>
                </div>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-500 flex items-center">Speed:</span>
                  {[1, 2, 5, 10].map(speed => (
                    <button 
                      key={speed} 
                      onClick={() => setPlaybackSpeed(speed)} 
                      className={`px-2 py-1 text-xs rounded border ${playbackSpeed === speed ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white hover:bg-gray-50'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
