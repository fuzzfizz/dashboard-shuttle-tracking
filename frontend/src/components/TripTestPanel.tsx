import React, { useState, useEffect } from 'react';
import { Route, MapPin, Flag, Play, Trash2, X, Loader2, AlertCircle, ClipboardPaste } from 'lucide-react';
import { TripLocation, VehicleTrip, MapPinMode, TripRoundStage } from '../types/trip';

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
          {activeTrip && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
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

          {/* Trip Summary Details if Active */}
          {activeTrip && (
            <div className="text-[10px] text-slate-700 dark:text-slate-300 bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-1">
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  เส้นทางจริงตามถนน (Road-Snapped)
                </span>
                {activeTrip.durationSeconds && (
                  <span className="text-slate-500 dark:text-slate-400 font-mono">
                    ~{Math.ceil(activeTrip.durationSeconds / 60)} นาที
                  </span>
                )}
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400 pt-0.5">
                <span>
                  ระยะทางใบจอง: {((activeTrip.distanceMeters || 0) / 1000).toFixed(2)} km
                </span>
                <span>จุดพิกัดถนน: {activeTrip.plannedPath.length} จุด</span>
              </div>
              {roundStage === 'arrived-dropoff' && (
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold pt-0.5 flex items-center gap-1 bg-emerald-100/60 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                  <span>🏁 ถึงจุดส่งแล้ว (แสดงรอยทาง 3 นาทีก่อนเริ่มรอบถัดไป)</span>
                </div>
              )}
              {roundStage === 'waiting-pickup' && (
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold pt-0.5 flex items-center gap-1 bg-amber-100/60 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                  <span>⏳ กำลังเดินทางไปยังจุดรับ เพื่อเริ่มจับรอยทางรอบใหม่</span>
                </div>
              )}
              {roundStage === 'in-transit' && (
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold pt-0.5 flex items-center gap-1 bg-emerald-100/60 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">
                  <span>🟢 กำลังบันทึกรอยทางจริงของรอบนี้ (สีเขียว)</span>
                </div>
              )}
              {activeTrip.alternativePaths && activeTrip.alternativePaths.length > 0 && (
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold pt-0.5 flex items-center gap-1">
                  <span>🔀 มีเส้นทางสำรองสีส้มประ (ซ่อนส่วนทับซ้อนแล้ว)</span>
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
