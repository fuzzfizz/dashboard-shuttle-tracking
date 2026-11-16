import React, { useState, useEffect } from 'react';
import { Route, MapPin, Flag, Play, Trash2, X, Loader2 } from 'lucide-react';
import { TripLocation, VehicleTrip, MapPinMode } from '../types/trip';

export interface TripTestPanelProps {
  vehicleIds: string[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string) => void;
  activeTrip?: VehicleTrip;
  pinMode: MapPinMode;
  onSetPinMode: (mode: MapPinMode) => void;
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
  pinMode,
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
  const [targetVehicleId, setTargetVehicleId] = useState<string>(selectedVehicleId || vehicleIds[0] || 'EV-01');
  const [pickup, setPickup] = useState<TripLocation>(
    activeTrip?.pickup || { lat: 18.7883, lng: 98.9853, name: 'คณะเภสัชฯ' }
  );
  const [dropoff, setDropoff] = useState<TripLocation>(
    activeTrip?.dropoff || { lat: 18.7900, lng: 98.9900, name: 'รพ.มหาราชฯ' }
  );

  useEffect(() => {
    if (selectedVehicleId) {
      setTargetVehicleId(selectedVehicleId);
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    if (activeTrip) {
      setPickup(activeTrip.pickup);
      setDropoff(activeTrip.dropoff);
    }
  }, [activeTrip]);

  // Handle incoming map click points during pin mode
  useEffect(() => {
    if (pendingPoint) {
      if (pinMode === 'pick-pickup') {
        setPickup({ lat: pendingPoint.lat, lng: pendingPoint.lng, name: 'จุดรับ (ระบุบนแผนที่)' });
        onSetPinMode('idle');
      } else if (pinMode === 'pick-dropoff') {
        setDropoff({ lat: pendingPoint.lat, lng: pendingPoint.lng, name: 'จุดส่ง (ระบุบนแผนที่)' });
        onSetPinMode('idle');
      }
    }
  }, [pendingPoint, pinMode, onSetPinMode]);

  const handleStart = () => {
    onStartTrip(targetVehicleId, pickup, dropoff);
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
        <div className="w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md flex flex-col gap-3.5 transition-all text-xs">
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
                onSetPinMode('idle');
              }}
              aria-label="Close test panel"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Vehicle Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              เลือกรถที่ต้องการทดสอบ:
            </label>
            <select
              value={targetVehicleId}
              onChange={(e) => {
                const id = e.target.value;
                setTargetVehicleId(id);
                onSelectVehicle(id);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-mono font-bold text-xs"
            >
              {vehicleIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {/* Pickup Point Input */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> จุดรับ (Pickup)
              </span>
              <button
                type="button"
                onClick={() => onSetPinMode(pinMode === 'pick-pickup' ? 'idle' : 'pick-pickup')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  pinMode === 'pick-pickup'
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}
              >
                {pinMode === 'pick-pickup' ? 'คลิกบนแผนที่...' : 'จิ้มจุดรับบนแผนที่'}
              </button>
            </div>
            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
              {pickup.lat.toFixed(5)}, {pickup.lng.toFixed(5)}
            </div>
          </div>

          {/* Dropoff Point Input */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                <Flag className="w-3.5 h-3.5" /> จุดส่ง (Dropoff)
              </span>
              <button
                type="button"
                onClick={() => onSetPinMode(pinMode === 'pick-dropoff' ? 'idle' : 'pick-dropoff')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  pinMode === 'pick-dropoff'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {pinMode === 'pick-dropoff' ? 'คลิกบนแผนที่...' : 'จิ้มจุดส่งบนแผนที่'}
              </button>
            </div>
            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
              {dropoff.lat.toFixed(5)}, {dropoff.lng.toFixed(5)}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Trip Summary Details if Active */}
          {activeTrip && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 bg-[#5c990e]/10 p-2 rounded-lg border border-[#5c990e]/20 flex justify-between">
              <span>ระยะทางใบจอง: {((activeTrip.distanceMeters || 0) / 1000).toFixed(2)} km</span>
              <span>จุดพิกัดถนน: {activeTrip.plannedPath.length} จุด</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isCalculating}
              onClick={handleStart}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#4a7c0b] hover:bg-[#3d6709] text-white font-bold transition-all shadow-sm disabled:opacity-50 min-h-[40px]"
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
