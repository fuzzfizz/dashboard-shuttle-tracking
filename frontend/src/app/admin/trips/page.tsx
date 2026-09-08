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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          ประวัติเที่ยววิ่ง (Trip History)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          ตรวจสอบประวัติการเดินรถ ระยะทางรวม และเปิดดูเส้นทางการวิ่งย้อนหลังแบบ Playback
        </p>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            วันที่ (Date)
          </label>
          <input
            type="date"
            value={filters.date}
            onChange={e => setFilters({ ...filters, date: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            ยานพาหนะ (Vehicle)
          </label>
          <select
            value={filters.vehicleId}
            onChange={e => setFilters({ ...filters, vehicleId: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all min-w-[160px]"
          >
            <option value="">รถทุกคัน (All Vehicles)</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.plate_number} ({v.model})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            สายรถ (Route)
          </label>
          <select
            value={filters.routeId}
            onChange={e => setFilters({ ...filters, routeId: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all min-w-[160px]"
          >
            <option value="">ทุกเส้นทาง (All Routes)</option>
            {routes.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            สถานะ (Status)
          </label>
          <select
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all min-w-[120px]"
          >
            <option value="All">ทั้งหมด (All)</option>
            <option value="completed">เสร็จสิ้น (Completed)</option>
            <option value="in_progress">กำลังวิ่ง (In Progress)</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">ยานพาหนะ</th>
                <th className="py-3.5 px-4">เส้นทาง</th>
                <th className="py-3.5 px-4">เวลาเริ่ม</th>
                <th className="py-3.5 px-4">เวลาสิ้นสุด / สถานะ</th>
                <th className="py-3.5 px-4">ระยะเวลา</th>
                <th className="py-3.5 px-4">ระยะทาง</th>
                <th className="py-3.5 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    กำลังโหลดข้อมูลเที่ยววิ่ง...
                  </td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลเที่ยววิ่งตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredTrips.map(trip => {
                  const vehicle = vehicles.find(v => v.id === trip.vehicle_id);
                  const route = routes.find(r => r.id === trip.route_id);
                  const isCompleted = trip.status === 'completed' || !!trip.ended_at;

                  return (
                    <tr key={trip.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {vehicle ? (
                          <div>
                            <div>{vehicle.plate_number}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{vehicle.model}</div>
                          </div>
                        ) : (
                          'Unknown'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {route ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: route.color || '#3b82f6' }} />
                            {route.name}
                          </span>
                        ) : (
                          'Unknown'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs tabular-nums">
                        {new Date(trip.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-3 px-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            เสร็จสิ้น ({trip.ended_at ? new Date(trip.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                            กำลังวิ่ง (In Progress)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs tabular-nums">
                        {formatDuration(trip.started_at, trip.ended_at)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 font-mono text-xs tabular-nums">
                        {(trip.total_distance_km || 0).toFixed(2)} km
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openTrip(trip)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          ▶ ดูเส้นทางย้อนหลัง
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
