import React from 'react';
import { Play, Pause, RotateCcw, Gauge, Clock, Navigation } from 'lucide-react';
import { HistoricalPoint, SpeedMultiplier } from '../types/historical';
import { formatTimeHHmmss } from '../services/historicalDateUtils';

interface ReplayPlayerBarProps {
  currentIndex: number;
  totalPoints: number;
  isPlaying: boolean;
  speedMultiplier: SpeedMultiplier;
  currentPoint: HistoricalPoint | null;
  startTimeStr: string | null;
  endTimeStr: string | null;
  totalDistanceKm: number;
  distanceCoveredKm: number;
  onTogglePlay: () => void;
  onReset: () => void;
  onSeek: (index: number) => void;
  onSpeedChange: (speed: SpeedMultiplier) => void;
}

const SPEED_OPTIONS: SpeedMultiplier[] = [1, 2, 5, 10, 30];

export const ReplayPlayerBar: React.FC<ReplayPlayerBarProps> = ({
  currentIndex,
  totalPoints,
  isPlaying,
  speedMultiplier,
  currentPoint,
  startTimeStr,
  endTimeStr,
  totalDistanceKm,
  distanceCoveredKm,
  onTogglePlay,
  onReset,
  onSeek,
  onSpeedChange,
}) => {
  const hasPoints = totalPoints > 1;
  const currentTimeDisplay = currentPoint ? formatTimeHHmmss(currentPoint.recorded_at) : '--:--:--';
  const startTimeDisplay = startTimeStr ? formatTimeHHmmss(startTimeStr) : '--:--:--';
  const endTimeDisplay = endTimeStr ? formatTimeHHmmss(endTimeStr) : '--:--:--';
  const currentSpeed = currentPoint ? `${currentPoint.speed.toFixed(1)} กม./ชม.` : '0.0 กม./ชม.';

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl z-[1000] transition-all">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
        {/* Top Row: Controls, Scrubber Slider, Speeds */}
        <div className="flex items-center gap-3 w-full">
          {/* Reset button */}
          <button
            onClick={onReset}
            disabled={!hasPoints}
            aria-label="ย้อนกลับจุดเริ่มต้น"
            title="ย้อนกลับจุดเริ่มต้น"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          {/* Play / Pause button */}
          <button
            onClick={onTogglePlay}
            disabled={!hasPoints}
            aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            title={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          {/* Timeline Time & Slider */}
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              {startTimeDisplay}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, totalPoints - 1)}
              value={currentIndex}
              disabled={!hasPoints}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Timeline Scrubber"
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40"
            />
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              {endTimeDisplay}
            </span>
          </div>

          {/* Speed Multipliers */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 shrink-0">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  speedMultiplier === speed
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Row: Real-time Telemetry HUD Chips */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span>เวลา:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {currentTimeDisplay}
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <Gauge className="w-4 h-4 text-emerald-500" />
              <span>ความเร็ว:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {currentSpeed}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Navigation className="w-4 h-4 text-emerald-500" />
            <span>ระยะทางสะสม:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {distanceCoveredKm.toFixed(1)} / {totalDistanceKm.toFixed(1)} กม.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ReplayPlayerBar;
