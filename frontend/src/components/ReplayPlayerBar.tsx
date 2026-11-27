import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Gauge, Clock, Navigation, ChevronUp, Check, Zap } from 'lucide-react';
import { HistoricalPoint, SpeedMultiplier } from '../types/historical';
import { formatTimeHHmmss } from '../services/historicalDateUtils';

export interface ReplayPlayerBarProps {
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
  className?: string;
  variant?: 'floating' | 'docked';
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
  className,
  variant = 'floating',
}) => {
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsSpeedMenuOpen(false);
      }
    };
    if (isSpeedMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpeedMenuOpen]);

  const hasPoints = totalPoints > 1;
  const currentTimeDisplay = currentPoint ? formatTimeHHmmss(currentPoint.recorded_at) : '--:--:--';
  const startTimeDisplay = startTimeStr ? formatTimeHHmmss(startTimeStr) : '--:--:--';
  const endTimeDisplay = endTimeStr ? formatTimeHHmmss(endTimeStr) : '--:--:--';
  const currentSpeed = currentPoint ? `${currentPoint.speed.toFixed(1)} กม./ชม.` : '0.0 กม./ชม.';

  const isDocked = variant === 'docked';

  const defaultContainerClasses = isDocked
    ? 'w-full bg-slate-50/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 rounded-b-2xl transition-all'
    : 'absolute bottom-3 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl z-[1000] pb-[env(safe-area-inset-bottom)] transition-all';

  const containerClasses = className ?? defaultContainerClasses;

  return (
    <div
      data-testid="replay-player-bar"
      data-variant={variant}
      className={containerClasses}
    >
      <div
        className={
          isDocked
            ? 'flex flex-col gap-2.5 w-full'
            : 'bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 sm:p-3.5 flex flex-col gap-2'
        }
      >
        {/* Main Control Row: Reset, Play, Scrubber, Time, and Speed Popover */}
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          {/* Reset button */}
          <button
            onClick={onReset}
            disabled={!hasPoints}
            aria-label="ย้อนกลับจุดเริ่มต้น"
            title="ย้อนกลับจุดเริ่มต้น"
            className="p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0"
          >
            <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Play / Pause button */}
          <button
            onClick={onTogglePlay}
            disabled={!hasPoints}
            aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            title={isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />}
          </button>

          {/* Timeline Scrubber */}
          <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0 hidden xs:inline">
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
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0 hidden xs:inline">
              {endTimeDisplay}
            </span>
          </div>

          {/* Compact Speed Popover (Replaces permanent speed buttons row) */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
              aria-label="เปลี่ยนความเร็วการเล่น"
              title="ความเร็วการเล่น"
              aria-expanded={isSpeedMenuOpen}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-800/90 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700/80 text-xs font-mono font-semibold shadow-xs transition-all min-h-[36px]"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="hidden sm:inline font-sans font-medium text-slate-500 dark:text-slate-400">ความเร็ว:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{speedMultiplier}x</span>
              <ChevronUp className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isSpeedMenuOpen ? 'rotate-180 text-emerald-500' : ''}`} />
            </button>

            {isSpeedMenuOpen && (
              <div
                role="menu"
                aria-label="เลือกความเร็วการเล่น"
                className="absolute bottom-full right-0 mb-2 w-36 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-1.5 z-[1100] animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                  ความเร็วเล่น
                </div>
                {SPEED_OPTIONS.map((speed) => (
                  <button
                    key={speed}
                    role="menuitem"
                    onClick={() => {
                      onSpeedChange(speed);
                      setIsSpeedMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-mono transition-colors text-left ${
                      speedMultiplier === speed
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs border border-emerald-200/60 dark:border-emerald-800/50'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <span>{speed}x</span>
                    {speedMultiplier === speed && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row: Real-time Telemetry HUD Chips */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-1.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 gap-1.5">
          <div className="flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="hidden xs:inline">เวลา:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {currentTimeDisplay}
            </span>
          </div>

          <div className="flex items-center gap-1 font-medium">
            <Gauge className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="hidden xs:inline">ความเร็ว:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {currentSpeed}
            </span>
          </div>

          <div className="flex items-center gap-1 font-medium">
            <Navigation className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="hidden xs:inline">ระยะทาง:</span>
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
