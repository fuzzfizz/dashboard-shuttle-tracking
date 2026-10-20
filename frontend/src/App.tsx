import { useShuttleTelemetry } from './hooks/useShuttleTelemetry';
import { ShuttleMap } from './components/ShuttleMap';
import { TelemetryHUD } from './components/TelemetryHUD';
import { Bus } from 'lucide-react';

export function App() {
  const { status, telemetry, lastSeen } = useShuttleTelemetry();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Top minimal header brand */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2.5 bg-white/95 backdrop-blur-sm border border-slate-200/80 px-3.5 py-2 rounded-xl shadow-md">
        <div className="p-1.5 bg-slate-900 text-white rounded-lg">
          <Bus className="w-4 h-4" />
        </div>
        <div>
          <h1 className="text-xs font-bold uppercase tracking-wider text-slate-800">Shuttle Tracker</h1>
          <p className="text-[10px] text-slate-400 font-mono">Live Hardware Gateway</p>
        </div>
      </div>

      {/* Floating HUD Card */}
      <TelemetryHUD telemetry={telemetry} status={status} lastSeen={lastSeen} />

      {/* Interactive Map */}
      <ShuttleMap telemetry={telemetry} defaultCenter={[13.7563, 100.5018]} zoom={15} />
    </div>
  );
}

export default App;
