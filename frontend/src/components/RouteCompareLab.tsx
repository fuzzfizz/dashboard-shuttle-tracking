import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Route,
  Columns,
  MapPin,
  Flag,
  Play,
  Info,
  ClipboardPaste,
  Key,
  ExternalLink,
  Sparkles,
  Layers,
} from 'lucide-react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { TripLocation, VehicleTrip } from '../types/trip';
import { calculateTripRoute } from '../services/tripRouteService';
import { calculateMapboxTripRoute } from '../services/mapboxRouteService';
import { TripRouteOverlay } from './TripRouteOverlay';
import { POPULAR_LOCATIONS, parseCoordinateString } from './TripTestPanel';

export const DEFAULT_LONGDO_KEY = '72ba939d7a7166c36d59b88d0b125307';
export const LONGDO_TILE_URL = `https://ms.longdo.com/mmmap/img.php?zoom={z}&x={x}&y={y}&mode=icons&key=${DEFAULT_LONGDO_KEY}&proj=epsg3857&HD=1`;
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface RouteCompareLabProps {
  onBack?: () => void;
}

export type CompareViewMode = 'split' | 'hybrid' | 'pure-mapbox' | 'pure-longdo' | 'pure-osrm';

export const RouteCompareLab: React.FC<RouteCompareLabProps> = ({ onBack }) => {
  const [viewMode, setViewMode] = useState<CompareViewMode>('split');

  // Mapbox Token state (supports localStorage & .env fallback)
  const [mapboxToken, setMapboxToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('mapbox_access_token') ||
        (import.meta as any).env?.VITE_MAPBOX_TOKEN ||
        ''
      );
    }
    return '';
  });

  // Input states
  const [pickup, setPickup] = useState<TripLocation>({
    lat: 18.7883,
    lng: 98.9853,
    name: 'คณะเภสัชฯ',
  });
  const [dropoff, setDropoff] = useState<TripLocation>({
    lat: 18.7900,
    lng: 98.9900,
    name: 'รพ.มหาราชฯ',
  });

  const [pickupName, setPickupName] = useState<string>('คณะเภสัชฯ');
  const [pickupLatStr, setPickupLatStr] = useState<string>('18.7883');
  const [pickupLngStr, setPickupLngStr] = useState<string>('98.9853');
  const [pickupPasteStr, setPickupPasteStr] = useState<string>('');

  const [dropoffName, setDropoffName] = useState<string>('รพ.มหาราชฯ');
  const [dropoffLatStr, setDropoffLatStr] = useState<string>('18.7900');
  const [dropoffLngStr, setDropoffLngStr] = useState<string>('98.9900');
  const [dropoffPasteStr, setDropoffPasteStr] = useState<string>('');

  // Results state
  const [mapboxTrip, setMapboxTrip] = useState<VehicleTrip | null>(null);
  const [osrmTrip, setOsrmTrip] = useState<VehicleTrip | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [mapboxError, setMapboxError] = useState<string | null>(null);
  const [longdoStatus, setLongdoStatus] = useState<string>('พร้อมโหลดแผนที่ Longdo SDK');

  // Longdo Map Native SDK references
  const longdoContainerRef = useRef<HTMLDivElement>(null);
  const longdoMapInstanceRef = useRef<any>(null);
  const longdoRouteGuideRef = useRef<HTMLDivElement>(null);

  // Save Token
  const handleSaveToken = (val: string) => {
    setMapboxToken(val);
    try {
      localStorage.setItem('mapbox_access_token', val.trim());
    } catch {}
  };

  // Smart paste handlers
  const handlePickupPaste = (text: string) => {
    setPickupPasteStr(text);
    const parsed = parseCoordinateString(text);
    if (parsed) {
      setPickupLatStr(String(parsed.lat));
      setPickupLngStr(String(parsed.lng));
      setPickup({ lat: parsed.lat, lng: parsed.lng, name: pickupName });
    }
  };

  const handleDropoffPaste = (text: string) => {
    setDropoffPasteStr(text);
    const parsed = parseCoordinateString(text);
    if (parsed) {
      setDropoffLatStr(String(parsed.lat));
      setDropoffLngStr(String(parsed.lng));
      setDropoff({ lat: parsed.lat, lng: parsed.lng, name: dropoffName });
    }
  };

  const handleApplyPreset = (
    type: 'pickup' | 'dropoff',
    loc: { name: string; lat: number; lng: number }
  ) => {
    if (type === 'pickup') {
      setPickupName(loc.name);
      setPickupLatStr(String(loc.lat));
      setPickupLngStr(String(loc.lng));
      setPickupPasteStr(`${loc.lat}, ${loc.lng}`);
      setPickup(loc);
    } else {
      setDropoffName(loc.name);
      setDropoffLatStr(String(loc.lat));
      setDropoffLngStr(String(loc.lng));
      setDropoffPasteStr(`${loc.lat}, ${loc.lng}`);
      setDropoff(loc);
    }
  };

  // Run calculation across routing engines
  const handleRunComparison = async () => {
    const pLat = parseFloat(pickupLatStr);
    const pLng = parseFloat(pickupLngStr);
    const dLat = parseFloat(dropoffLatStr);
    const dLng = parseFloat(dropoffLngStr);

    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) return;

    const currentPickup: TripLocation = { lat: pLat, lng: pLng, name: pickupName };
    const currentDropoff: TripLocation = { lat: dLat, lng: dLng, name: dropoffName };

    setPickup(currentPickup);
    setDropoff(currentDropoff);
    setIsCalculating(true);
    setMapboxError(null);

    // 1. Calculate Mapbox route if token available
    if (mapboxToken?.trim()) {
      try {
        const mbTrip = await calculateMapboxTripRoute(
          'EV-MAPBOX',
          currentPickup,
          currentDropoff,
          mapboxToken.trim()
        );
        setMapboxTrip(mbTrip);
      } catch (err: any) {
        setMapboxError(err?.message || 'Mapbox API request failed');
        // Fallback to OSRM so user still sees the path
        try {
          const fb = await calculateTripRoute('EV-FALLBACK', currentPickup, currentDropoff);
          setMapboxTrip(fb);
        } catch {}
      }
    } else {
      // No token provided: simulate via OSRM with warning
      try {
        const trip = await calculateTripRoute('EV-OSRM', currentPickup, currentDropoff);
        setMapboxTrip(trip);
      } catch {}
    }

    // 2. Calculate OSRM route
    try {
      const trip = await calculateTripRoute('EV-OSRM', currentPickup, currentDropoff);
      setOsrmTrip(trip);
    } catch (e) {
      console.error('OSRM route calculation failed', e);
    }

    // 3. Trigger Longdo Native Map Route if SDK loaded
    if (longdoMapInstanceRef.current && (window as any).longdo) {
      try {
        const longdo = (window as any).longdo;
        const map = longdoMapInstanceRef.current;
        map.Route.clear();
        map.Route.add(
          new longdo.Marker(
            { lon: currentPickup.lng, lat: currentPickup.lat },
            { title: currentPickup.name || 'จุดรับ' }
          )
        );
        map.Route.add(
          new longdo.Marker(
            { lon: currentDropoff.lng, lat: currentDropoff.lat },
            { title: currentDropoff.name || 'จุดส่ง' }
          )
        );
        map.Route.search();
        setLongdoStatus('คำนวณและวาดเส้นทางบน Longdo Map สำเร็จ');
      } catch (err: any) {
        setLongdoStatus(`Longdo SDK Route: ${err?.message || 'Unknown'}`);
      }
    }

    setIsCalculating(false);
  };

  // Load Longdo Map Native SDK dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const initLongdoMap = () => {
      const longdo = (window as any).longdo;
      if (!longdo || !longdo.Map || !longdoContainerRef.current) return;
      if (longdoMapInstanceRef.current) return;

      try {
        const map = new longdo.Map({
          placeholder: longdoContainerRef.current,
          language: 'th',
        });
        if (longdoRouteGuideRef.current && map.Route) {
          map.Route.placeholder(longdoRouteGuideRef.current);
        }
        longdoMapInstanceRef.current = map;
        setLongdoStatus('Longdo Map SDK โหลดเสร็จสมบูรณ์');

        // Initial search
        map.Route.clear();
        map.Route.add(
          new longdo.Marker(
            { lon: pickup.lng, lat: pickup.lat },
            { title: pickup.name || 'จุดรับ' }
          )
        );
        map.Route.add(
          new longdo.Marker(
            { lon: dropoff.lng, lat: dropoff.lat },
            { title: dropoff.name || 'จุดส่ง' }
          )
        );
        map.Route.search();
      } catch (e: any) {
        if (isMounted) setLongdoStatus(`ไม่สามารถสร้าง Longdo Map: ${e?.message}`);
      }
    };

    if ((window as any).longdo && (window as any).longdo.Map) {
      initLongdoMap();
    } else {
      const scriptId = 'longdo-native-sdk-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://api.longdo.com/map/?key=${DEFAULT_LONGDO_KEY}`;
        script.async = true;
        script.onload = () => {
          if (isMounted) initLongdoMap();
        };
        script.onerror = () => {
          if (isMounted) setLongdoStatus('ไม่สามารถเชื่อมต่อ Longdo Map SDK CDN ได้');
        };
        document.body.appendChild(script);
      }
    }

    // Initial default calculations
    calculateTripRoute('EV-DEFAULT', pickup, dropoff).then((t) => {
      if (isMounted) {
        setOsrmTrip(t);
        setMapboxTrip(t);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const mapboxTileUrl = mapboxToken?.trim()
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken.trim()}`
    : OSM_TILE_URL;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Header & Navigation */}
      <header className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="กลับสู่แดชบอร์ด"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>กลับสู่แดชบอร์ด</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Route className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Route Engine Comparison Lab
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono font-semibold border border-indigo-200 dark:border-indigo-800">
                  Mapbox vs Longdo vs OSRM
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เปรียบเทียบ Longdo Map Native 100% vs OpenStreetMap + OSRM 100% vs แบบผสม (Hybrid) vs Pure Mapbox
              </p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split View (เปรียบเทียบ)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('hybrid')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'hybrid'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>แบบผสม (Longdo + Mapbox)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pure-mapbox')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'pure-mapbox'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🌐 Pure Mapbox (100%)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pure-longdo')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'pure-longdo'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🇹🇭 Pure Longdo (100%)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pure-osrm')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                viewMode === 'pure-osrm'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🌍 Pure OSRM (100%)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-4">
        {/* Mapbox Token Configuration Bar */}
        <section className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-emerald-500/10 p-3.5 rounded-2xl border border-blue-500/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white">Mapbox Access Token:</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ใช้สำหรับเรียก Mapbox Directions API (ฟรี 100,000 requests/เดือน) และ Mapbox Streets Tiles
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="password"
              aria-label="Mapbox Access Token"
              placeholder="pk.eyJ1Ijo... (ใส่ Token ที่นี่)"
              value={mapboxToken}
              onChange={(e) => handleSaveToken(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs w-full sm:w-72 outline-none focus:ring-1 focus:ring-blue-500"
            />
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              title="รับฟรี Token ที่ mapbox.com"
            >
              <span>ขอรับ Token ฟรี</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {mapboxError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
            <Info className="w-4 h-4 shrink-0 text-rose-600" />
            <span>
              ⚠️ <b>Mapbox Error:</b> {mapboxError} (กำลังใช้แนวเส้นทางจำลองแทนชั่วคราว)
            </span>
          </div>
        )}

        {!mapboxToken?.trim() && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              💡 <b>ยังไม่ได้ใส่ Mapbox Access Token:</b> สามารถทดสอบระบบเบื้องต้นได้ (ระบบจะใช้ OSRM จำลองแนวเส้นทางให้ชั่วคราว) หรือสมัครรับ Token ฟรีที่ mapbox.com เพื่อทดสอบ Mapbox ของจริงแบบ 100% ครับ
            </span>
          </div>
        )}

        {/* Interactive Coordinate Controller Box */}
        <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pickup Point Controller */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-xs">
                  <MapPin className="w-3.5 h-3.5" /> จุดรับ (Pickup)
                </span>
              </div>

              {/* Paste bar */}
              <div>
                <label htmlFor="lab-pickup-paste" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  วางพิกัดจุดรับรวม (Lat, Lng):
                </label>
                <div className="relative flex items-center">
                  <input
                    id="lab-pickup-paste"
                    aria-label="วางพิกัดจุดรับรวม"
                    type="text"
                    placeholder="18.7883, 98.9853 หรือก๊อบปี้จาก Google Maps"
                    value={pickupPasteStr}
                    onChange={(e) => handlePickupPaste(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <ClipboardPaste className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                </div>
              </div>

              {/* Coordinate Inputs */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label htmlFor="lab-pickup-lat" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                    ละติจูด (Lat)
                  </label>
                  <input
                    id="lab-pickup-lat"
                    aria-label="ละติจูดจุดรับ"
                    type="text"
                    value={pickupLatStr}
                    onChange={(e) => setPickupLatStr(e.target.value)}
                    className="w-full px-2 py-1 font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="lab-pickup-lng" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                    ลองจิจูด (Lng)
                  </label>
                  <input
                    id="lab-pickup-lng"
                    aria-label="ลองจิจูดจุดรับ"
                    type="text"
                    value={pickupLngStr}
                    onChange={(e) => setPickupLngStr(e.target.value)}
                    className="w-full px-2 py-1 font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1 pt-1">
                {POPULAR_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    aria-label={`${loc.name} (จุดรับ)`}
                    onClick={() => handleApplyPreset('pickup', loc)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50"
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropoff Point Controller */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1 text-xs">
                  <Flag className="w-3.5 h-3.5" /> จุดส่ง (Dropoff)
                </span>
              </div>

              {/* Paste bar */}
              <div>
                <label htmlFor="lab-dropoff-paste" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                  วางพิกัดจุดส่งรวม (Lat, Lng):
                </label>
                <div className="relative flex items-center">
                  <input
                    id="lab-dropoff-paste"
                    aria-label="วางพิกัดจุดส่งรวม"
                    type="text"
                    placeholder="18.7900, 98.9900 หรือก๊อบปี้จาก Google Maps"
                    value={dropoffPasteStr}
                    onChange={(e) => handleDropoffPaste(e.target.value)}
                    className="w-full pl-7 pr-2 py-1 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <ClipboardPaste className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                </div>
              </div>

              {/* Coordinate Inputs */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label htmlFor="lab-dropoff-lat" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                    ละติจูด (Lat)
                  </label>
                  <input
                    id="lab-dropoff-lat"
                    aria-label="ละติจูดจุดส่ง"
                    type="text"
                    value={dropoffLatStr}
                    onChange={(e) => setDropoffLatStr(e.target.value)}
                    className="w-full px-2 py-1 font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="lab-dropoff-lng" className="block text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                    ลองจิจูด (Lng)
                  </label>
                  <input
                    id="lab-dropoff-lng"
                    aria-label="ลองจิจูดจุดส่ง"
                    type="text"
                    value={dropoffLngStr}
                    onChange={(e) => setDropoffLngStr(e.target.value)}
                    className="w-full px-2 py-1 font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none"
                  />
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1 pt-1">
                {POPULAR_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    aria-label={`${loc.name} (จุดส่ง)`}
                    onClick={() => handleApplyPreset('dropoff', loc)}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/50"
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              disabled={isCalculating}
              onClick={handleRunComparison}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isCalculating ? 'กำลังคำนวณเส้นทาง...' : 'คำนวณเส้นทาง (Run Comparison)'}</span>
            </button>
          </div>
        </section>

        {/* Maps Comparison Grid */}
        <div
          className={`grid gap-4 flex-1 ${
            viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {/* View Option 1: 🌟 แบบผสม (Hybrid: Longdo Map Base + Mapbox Directions) */}
          {(viewMode === 'split' || viewMode === 'hybrid') && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md flex flex-col min-h-[480px]">
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/30 border-b border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    🇹🇭 แบบผสม (Hybrid: Longdo Map + Mapbox Directions)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                    แนวทางที่แนะนำ
                  </span>
                </div>
                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
                  {mapboxTrip?.distanceMeters
                    ? `${(mapboxTrip.distanceMeters / 1000).toFixed(2)} km (~${Math.ceil((mapboxTrip.durationSeconds || 0) / 60)} นาที)`
                    : 'พร้อมคำนวณ'}
                </div>
              </div>

              {/* Hybrid Map Container */}
              <div className="relative flex-1 w-full min-h-[380px] bg-slate-200 dark:bg-slate-800">
                <MapContainer
                  center={[pickup.lat, pickup.lng]}
                  zoom={14}
                  zoomControl={false}
                  attributionControl={false}
                  className="w-full h-full min-h-[380px]"
                >
                  <TileLayer
                    url={LONGDO_TILE_URL}
                    attribution='&copy; <a href="https://map.longdo.com/">Longdo Map</a>'
                  />
                  {mapboxTrip && <TripRouteOverlay trip={mapboxTrip} />}
                </MapContainer>
                <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl text-[10px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 pointer-events-none z-[1000]">
                  ✨ <b>จุดเด่นแบบผสม:</b> ฉากหลังเป็นแผนที่ Longdo ภาษาไทยละเอียดชัดเจน + เส้นทางประเรืองแสงมาจาก Mapbox Directions API (เสถียร ไม่โดนแบน โควตาฟรี 100,000 ครั้ง/เดือน)
                </div>
              </div>

              {mapboxTrip && (
                <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span>ระยะทางใบจอง: {((mapboxTrip.distanceMeters || 0) / 1000).toFixed(2)} km</span>
                  <span>เวลาประเมิน: ~{Math.ceil((mapboxTrip.durationSeconds || 0) / 60)} นาที</span>
                  <span>จุดพิกัดโค้งถนน: {mapboxTrip.plannedPath.length} จุด</span>
                </div>
              )}
            </div>
          )}

          {/* View Option 2: 🌐 100% Pure Mapbox (Mapbox Streets + Mapbox Directions) */}
          {(viewMode === 'split' || viewMode === 'pure-mapbox') && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md flex flex-col min-h-[480px]">
              <div className="p-3 bg-blue-500/10 dark:bg-blue-950/30 border-b border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    🌐 100% Pure Mapbox
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-semibold">
                    Mapbox Streets + Directions
                  </span>
                </div>
                <div className="text-[11px] font-mono text-blue-700 dark:text-blue-300 font-semibold">
                  {mapboxTrip?.distanceMeters
                    ? `${(mapboxTrip.distanceMeters / 1000).toFixed(2)} km`
                    : 'พร้อมคำนวณ'}
                </div>
              </div>

              {/* Pure Mapbox Container */}
              <div
                data-testid="mapbox-map-container"
                className="relative flex-1 w-full min-h-[380px] bg-slate-200 dark:bg-slate-800"
              >
                <MapContainer
                  center={[pickup.lat, pickup.lng]}
                  zoom={14}
                  zoomControl={false}
                  attributionControl={false}
                  className="w-full h-full min-h-[380px]"
                >
                  <TileLayer
                    url={mapboxTileUrl}
                    attribution='&copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                  />
                  {mapboxTrip && <TripRouteOverlay trip={mapboxTrip} />}
                </MapContainer>
                <div className="absolute bottom-2 left-2 right-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl text-[10px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 pointer-events-none z-[1000]">
                  🌐 <b>จุดเด่น Pure Mapbox:</b> ทั้งภาพแผนที่ถนนและเส้นทางเป็นระบบของ Mapbox ทั้งหมด เส้นทางจึงแนบสนิทกับถนนของ Mapbox แบบ Pixel-Perfect
                </div>
              </div>

              {mapboxTrip && (
                <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span>ระยะทาง: {((mapboxTrip.distanceMeters || 0) / 1000).toFixed(2)} km</span>
                  <span>เวลาประเมิน: ~{Math.ceil((mapboxTrip.durationSeconds || 0) / 60)} นาที</span>
                  <span>สถานะ Token: {mapboxToken ? '✓ เชื่อมต่อแล้ว' : '⚠️ ใช้ OSRM จำลอง'}</span>
                </div>
              )}
            </div>
          )}

          {/* View Option 3: 🇹🇭 100% Pure Longdo Map Native SDK */}
          {viewMode === 'pure-longdo' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md flex flex-col min-h-[480px]">
              <div className="p-3 bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    🇹🇭 100% Pure Longdo Map
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-semibold">
                    Longdo SDK + Longdo Route
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {longdoStatus}
                </div>
              </div>

              <div className="relative flex-1 w-full min-h-[380px] bg-slate-200 dark:bg-slate-800">
                <div
                  ref={longdoContainerRef}
                  data-testid="longdo-native-container"
                  className="w-full h-full min-h-[380px]"
                />
              </div>

              <div
                ref={longdoRouteGuideRef}
                className="max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300"
              />
            </div>
          )}

          {/* View Option 4: 🌍 100% Pure OSRM */}
          {viewMode === 'pure-osrm' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md flex flex-col min-h-[480px]">
              <div className="p-3 bg-slate-500/10 dark:bg-slate-800/40 border-b border-slate-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    🌍 100% Pure OpenStreetMap + OSRM
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold">
                    OSM Tiles + OSRM Demo Server
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-semibold">
                  {osrmTrip?.distanceMeters
                    ? `${(osrmTrip.distanceMeters / 1000).toFixed(2)} km`
                    : 'พร้อมคำนวณ'}
                </div>
              </div>

              <div className="relative flex-1 w-full min-h-[380px] bg-slate-200 dark:bg-slate-800">
                <MapContainer
                  center={[pickup.lat, pickup.lng]}
                  zoom={14}
                  zoomControl={false}
                  attributionControl={false}
                  className="w-full h-full min-h-[380px]"
                >
                  <TileLayer url={OSM_TILE_URL} attribution='&copy; OpenStreetMap' />
                  {osrmTrip && <TripRouteOverlay trip={osrmTrip} />}
                </MapContainer>
              </div>

              {osrmTrip && (
                <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span>ระยะทาง: {((osrmTrip.distanceMeters || 0) / 1000).toFixed(2)} km</span>
                  <span>เวลาประเมิน: ~{Math.ceil((osrmTrip.durationSeconds || 0) / 60)} นาที</span>
                  <span>จุดพิกัดโค้งถนน: {osrmTrip.plannedPath.length} จุด</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comparative Insights Card */}
        <section className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Info className="w-4 h-4 text-indigo-500" />
            <span>ข้อเปรียบเทียบระหว่างแบบผสม (Longdo + Mapbox) กับ Pure Mapbox</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> 🇹🇭 แบบผสม (Longdo Map + Mapbox Directions):
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li><b>แผนที่ฉากหลัง:</b> เป็น Longdo Map ภาษาไทย ชัดเจน มีชื่อตึก อาคาร ซอยในเชียงใหม่ครบถ้วน</li>
                <li><b>การคำนวณเส้นทาง:</b> ใช้ Mapbox Directions API ซึ่งมีความเสถียรระดับ Enterprise และมีโควตาฟรี 100,000 requests/เดือน</li>
                <li><b>ความเข้ากันได้:</b> เส้นทางลอยตัววาดลงบน Leaflet ได้อย่างลื่นไหล ไม่ต้องกังวลเรื่องการโดนบล็อก IP เหมือน OSRM Demo Server</li>
              </ul>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <div className="font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> 🌐 100% Pure Mapbox (Mapbox Streets + Directions):
              </div>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li><b>ความแนบสนิทของถนน:</b> ทั้งภาพกระเบื้องถนนและเส้นเวกเตอร์ทางเลี้ยวมาจาก Mapbox จึงตรงตามแนวถนนแบบ Pixel-Perfect 100%</li>
                <li><b>สไตล์แผนที่:</b> โมเดิร์นระดับโลก โทนสีมาตรฐาน</li>
                <li><b>ข้อสังเกต:</b> รายละเอียดชื่ออาคารย่อยและซอยเล็กๆ ในไทย อาจไม่ละเอียดเท่าฐานข้อมูลเฉพาะของ Longdo Map</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
