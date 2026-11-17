import React, { useState, useEffect } from 'react';
import {
  Route,
  MapPin,
  Flag,
  Play,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  ClipboardPaste,
  Clock,
  Navigation,
} from 'lucide-react';
import { TripLocation, VehicleTrip, MapPinMode, TripRoundStage } from '../types/trip';
import { calculateTripProgressMetrics } from '../services/tripMetricsService';

export const POPULAR_LOCATIONS: Array<{ name: string; lat: number; lng: number }> = [
  { name: 'คณะเภสัชฯ', lat: 18.7883, lng: 98.9853 },
  { name: 'รพ.มหาราชฯ', lat: 18.7900, lng: 98.9900 },
  { name: 'คณะแพทย์', lat: 18.7892, lng: 98.9785 },
  { name: 'ศาลาธรรม', lat: 18.8035, lng: 98.9515 },
  { name: 'ประตู มช.', lat: 18.8065, lng: 98.9560 },
];

/**
 * Parses full coordinate strings like "18.790094565006996, 98.96547138689851"
 * Supports commas, spaces, semicolons, and tabs as separators.
 */
export function parseCoordinateString(text: string): { lat: number; lng: number } | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/^\(/, '').replace(/\)$/, '').trim();
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)[,\s;\t]+(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export interface TripTestPanelProps {
  vehicleIds: string[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  activeTrip?: VehicleTrip;
  roundStage?: TripRoundStage;
  currentLocation?: { lat: number; lng: number; speed?: number } | null;
  pinMode?: MapPinMode;
  onSetPinMode?: (mode: MapPinMode) => void;
  onStartTrip: (vehicleId: string, pickup: TripLocation, dropoff: TripLocation) => void;
  onClearTrip: (vehicleId: string) => void;
  pendingPoint?: { lat: number; lng: number } | null;
  isCalculating?: boolean;
  error?: string | null;
  className?: string;
}

export const TripTestPanel: React.FC<TripTestPanelProps> = ({
  vehicleIds,
  selectedVehicleId,
  onSelectVehicle,
  activeTrip,
  roundStage,
  currentLocation,
  pinMode = 'idle',
  onSetPinMode,
  onStartTrip,
  onClearTrip,
  pendingPoint,
  isCalculating = false,
  error = null,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Form local state
  const [targetVehicleId, setTargetVehicleId] = useState<string>(
    selectedVehicleId || vehicleIds[0] || 'EV-01'
  );

  const initialPickup = activeTrip?.pickup || {
    lat: 18.7883,
    lng: 98.9853,
    name: 'คณะเภสัชฯ',
  };
  const initialDropoff = activeTrip?.dropoff || {
    lat: 18.7900,
    lng: 98.9900,
    name: 'รพ.มหาราชฯ',
  };

  const [pickupName, setPickupName] = useState<string>(initialPickup.name || 'คณะเภสัชฯ');
  const [pickupCoordStr, setPickupCoordStr] = useState<string>(
    `${initialPickup.lat}, ${initialPickup.lng}`
  );

  const [dropoffName, setDropoffName] = useState<string>(initialDropoff.name || 'รพ.มหาราชฯ');
  const [dropoffCoordStr, setDropoffCoordStr] = useState<string>(
    `${initialDropoff.lat}, ${initialDropoff.lng}`
  );

  useEffect(() => {
    if (selectedVehicleId) {
      setTargetVehicleId(selectedVehicleId);
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    if (activeTrip) {
      setPickupName(activeTrip.pickup.name || '');
      setPickupCoordStr(`${activeTrip.pickup.lat}, ${activeTrip.pickup.lng}`);

      setDropoffName(activeTrip.dropoff.name || '');
      setDropoffCoordStr(`${activeTrip.dropoff.lat}, ${activeTrip.dropoff.lng}`);
    }
  }, [activeTrip]);

  // Handle incoming map click points if any map listener triggers
  useEffect(() => {
    if (pendingPoint) {
      if (pinMode === 'pick-pickup') {
        setPickupCoordStr(`${pendingPoint.lat}, ${pendingPoint.lng}`);
        setPickupName('จุดรับ (ระบุบนแผนที่)');
        onSetPinMode?.('idle');
      } else if (pinMode === 'pick-dropoff') {
        setDropoffCoordStr(`${pendingPoint.lat}, ${pendingPoint.lng}`);
        setDropoffName('จุดส่ง (ระบุบนแผนที่)');
        onSetPinMode?.('idle');
      }
    }
  }, [pendingPoint, pinMode, onSetPinMode]);

  const parsedPickup = parseCoordinateString(pickupCoordStr);
  const parsedDropoff = parseCoordinateString(dropoffCoordStr);

  const isPickupValid = parsedPickup !== null;
  const isDropoffValid = parsedDropoff !== null;
  const areCoordsValid = isPickupValid && isDropoffValid;

  const progressMetrics = calculateTripProgressMetrics(
    activeTrip,
    currentLocation,
    roundStage
  );

  const handleStart = () => {
    if (!areCoordsValid || !parsedPickup || !parsedDropoff) return;
    onStartTrip(
      targetVehicleId,
      {
        lat: parsedPickup.lat,
        lng: parsedPickup.lng,
        name: pickupName.trim() || undefined,
      },
      {
        lat: parsedDropoff.lat,
        lng: parsedDropoff.lng,
        name: dropoffName.trim() || undefined,
      }
    );
  };

  const handleClear = () => {
    onClearTrip(targetVehicleId);
  };

  return (
    <div className={`pointer-events-auto ${className}`}>
      {/* Collapsed Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="ทดสอบเส้นทาง (Route Test)"
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-md backdrop-blur-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all min-h-[40px]"
        >
          <Route className="w-4 h-4 text-[#4a7c0b]" />
          <span>ทดสอบเส้นทาง</span>
          {activeTrip && (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full font-mono border border-emerald-300 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {progressMetrics
                ? `เหลือ ${progressMetrics.remainingDistanceKm.toFixed(1)} กม. (${progressMetrics.formattedEta})`
                : 'เริ่มทริปแล้ว'}
            </span>
          )}
        </button>
      )}

      {/* Expanded Floating Test Panel */}
      {isOpen && (
        <div className="w-88 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md flex flex-col gap-3.5 transition-all text-xs">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Route className="w-4 h-4 text-[#4a7c0b]" />
              <span>กำหนดจุดรับ-ส่ง สำหรับทดสอบ</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSetPinMode?.('idle');
              }}
              aria-label="Close test panel"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Vehicle Selector */}
          <div>
            <label
              htmlFor="test-vehicle-select"
              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1"
            >
              เลือกรถที่ต้องการทดสอบ:
            </label>
            <select
              id="test-vehicle-select"
              value={targetVehicleId}
              onChange={(e) => {
                const id = e.target.value;
                setTargetVehicleId(id);
                onSelectVehicle(id);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
            >
              {vehicleIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {/* Pickup Point Input Section */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> จุดรับ (Pickup)
              </span>
            </div>

            {/* Unified Coordinates (Lat, Lng) */}
            <div>
              <label
                htmlFor="pickup-coord-input"
                className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5"
              >
                พิกัดจุดรับ (Lat, Lng)
              </label>
              <div className="relative flex items-center">
                <input
                  id="pickup-coord-input"
                  aria-label="พิกัดจุดรับ"
                  type="text"
                  placeholder="เช่น 18.7883, 98.9853 หรือวางพิกัดรวม"
                  value={pickupCoordStr}
                  onChange={(e) => setPickupCoordStr(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-sans focus:ring-1 focus:ring-emerald-500 outline-none"
                />
                <ClipboardPaste className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
              </div>
            </div>

            {/* Location Name */}
            <div>
              <label htmlFor="pickup-name-input" className="sr-only">
                ชื่อจุดรับ
              </label>
              <input
                id="pickup-name-input"
                aria-label="ชื่อจุดรับ"
                type="text"
                placeholder="ชื่อสถานที่จุดรับ (เช่น คณะเภสัชฯ)"
                value={pickupName}
                onChange={(e) => setPickupName(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Dropoff Point Input Section */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <Flag className="w-3.5 h-3.5" /> จุดส่ง (Dropoff)
              </span>
            </div>

            {/* Unified Coordinates (Lat, Lng) */}
            <div>
              <label
                htmlFor="dropoff-coord-input"
                className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5"
              >
                พิกัดจุดส่ง (Lat, Lng)
              </label>
              <div className="relative flex items-center">
                <input
                  id="dropoff-coord-input"
                  aria-label="พิกัดจุดส่ง"
                  type="text"
                  placeholder="เช่น 18.7900, 98.9900 หรือวางพิกัดรวม"
                  value={dropoffCoordStr}
                  onChange={(e) => setDropoffCoordStr(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 placeholder:font-sans focus:ring-1 focus:ring-rose-500 outline-none"
                />
                <ClipboardPaste className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
              </div>
            </div>

            {/* Location Name */}
            <div>
              <label htmlFor="dropoff-name-input" className="sr-only">
                ชื่อจุดส่ง
              </label>
              <input
                id="dropoff-name-input"
                aria-label="ชื่อจุดส่ง"
                type="text"
                placeholder="ชื่อสถานที่จุดส่ง (เช่น รพ.มหาราชฯ)"
                value={dropoffName}
                onChange={(e) => setDropoffName(e.target.value)}
                className="w-full px-2 py-1 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:ring-1 focus:ring-rose-500 outline-none"
              />
            </div>
          </div>

          {/* Validation Alert */}
          {!areCoordsValid && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>กรุณากรอกพิกัดละติจูดและลองจิจูดที่ถูกต้อง</span>
            </div>
          )}

          {/* API Error Message */}
          {error && (
            <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Trip Progress, Distance & ETA Card */}
          {activeTrip && progressMetrics && (
            <div
              data-testid="trip-progress-card"
              className="rounded-xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 p-3 space-y-2.5 shadow-sm"
            >
              {/* Header with Vehicle Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>ข้อมูลระยะทางและเวลา</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-semibold">
                  {activeTrip.vehicleId}
                </span>
              </div>

              {/* Grid: Total Distance & Remaining Distance with ETA */}
              <div className="grid grid-cols-2 gap-2">
                {/* Total Distance from Start to End */}
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Route className="w-3 h-3 text-indigo-500 shrink-0" />
                    <span>ระยะทางจุดเริ่ม ➔ จุดสิ้นสุด</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono mt-1">
                    {progressMetrics.totalDistanceKm.toFixed(2)}{' '}
                    <span className="text-[10px] font-sans font-normal text-slate-500 dark:text-slate-400">
                      กม.
                    </span>
                  </div>
                  <div
                    className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5"
                    title={`${activeTrip.pickup.name || 'จุดรับ'} ➔ ${activeTrip.dropoff.name || 'จุดส่ง'}`}
                  >
                    {activeTrip.pickup.name || 'จุดรับ'} ➔ {activeTrip.dropoff.name || 'จุดส่ง'}
                  </div>
                </div>

                {/* Remaining Distance & ETA to Dropoff */}
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex flex-col justify-between">
                  <div className="text-[10px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>เวลาที่เหลือจนถึงจุดส่ง</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    {progressMetrics.formattedEta}
                  </div>
                  <div className="text-[9px] text-emerald-600 dark:text-emerald-400/90 font-mono mt-0.5">
                    เหลืออีก {progressMetrics.remainingDistanceKm.toFixed(2)} กม.
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  <span>ความคืบหน้าการเดินทาง</span>
                  <span className="font-mono">{progressMetrics.progressPercent}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${progressMetrics.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Stage Status Badge */}
              {roundStage === 'dwelling-dropoff' && (
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold p-1.5 rounded-lg flex items-center gap-1.5 bg-amber-100/70 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block shrink-0" />
                  <span>🟡 ถึงจุดส่งแล้ว — กำลังจอดส่งผู้โดยสารลงรถ (1 นาที)</span>
                </div>
              )}
              {roundStage === 'arrived-dropoff' && (
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold p-1.5 rounded-lg flex items-center gap-1.5 bg-emerald-100/70 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50">
                  <span>🏁 ส่งผู้โดยสารเสร็จสิ้น — หยุดวาดเส้น (แสดงรอยทาง 3 นาที)</span>
                </div>
              )}
              {roundStage === 'waiting-pickup' && (
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold p-1.5 rounded-lg flex items-center gap-1.5 bg-amber-100/60 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50">
                  <span>⏳ กำลังเดินทางไปยังจุดรับ เพื่อเริ่มจับรอยทางรอบใหม่</span>
                </div>
              )}
              {roundStage === 'in-transit' && (
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold p-1.5 rounded-lg flex items-center gap-1.5 bg-emerald-100/70 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>🟢 กำลังเดินทางไปยังจุดส่ง (บันทึกรอยทางสีเขียว)</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isCalculating || !areCoordsValid}
              onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#4a7c0b] hover:bg-[#3d6709] text-white font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังคำนวณ...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>คำนวณและเริ่มทริป</span>
                </>
              )}
            </button>

            {activeTrip && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="ล้างเส้นทาง"
                title="ล้างเส้นทาง / จบทริป"
                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950 dark:text-slate-400 dark:hover:text-rose-300 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
