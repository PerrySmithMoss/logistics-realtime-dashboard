import { memo } from "react";
import { FleetVehicle, SseConnectionStatus } from "../types";

interface FleetMapOverlayProps {
  sseStatus: SseConnectionStatus;
  delayedVehicles: FleetVehicle[];
  onVehicleClick: (v: FleetVehicle) => void;
}

export const FleetMapOverlay = memo(
  ({ sseStatus, delayedVehicles, onVehicleClick }: FleetMapOverlayProps) => {
    return (
      <>
        <div className="absolute top-6 right-6 z-20">
          <ConnectionIndicator status={sseStatus} />
        </div>

        {delayedVehicles.length > 0 && (
          <nav className="absolute bottom-6 left-6 right-24 flex gap-2 overflow-x-auto no-scrollbar pointer-events-none pb-2">
            {delayedVehicles.map((v) => (
              <button
                key={v.id}
                onClick={() => onVehicleClick(v)}
                className="pointer-events-auto cursor-pointer shrink-0 bg-white/90 backdrop-blur-sm border border-red-100 px-3 py-2 rounded-xl shadow-lg text-red-600 text-xs font-bold hover:bg-red-50 hover:-translate-y-0.5 transition-all active:scale-95"
              >
                ⚠️ {v.id}
              </button>
            ))}
          </nav>
        )}

        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200 z-10">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">
            Live Fleet Status
          </h4>
          <div className="space-y-3">
            <LegendItem color="#10b981" label="Active" />
            <LegendItem color="#ef4444" label="Delayed" />
          </div>
        </div>
      </>
    );
  },
);

const ConnectionIndicator = ({ status }: { status: SseConnectionStatus }) => {
  if (status === "connected") return null;

  const isConnecting = status === "connecting";

  return (
    <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-full border border-slate-200 shadow-sm text-[11px] font-semibold text-slate-600">
      <span
        className={`w-2 h-2 rounded-full ${isConnecting ? "bg-amber-400 animate-pulse" : "bg-red-500"}`}
      />
      {isConnecting ? "Reconnecting..." : "Connection Lost"}
    </div>
  );
};

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-3">
    <span
      className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
      style={{ backgroundColor: color }}
    />
    <span className="text-[11px] font-bold text-slate-600">{label}</span>
  </div>
);

FleetMapOverlay.displayName = "FleetMapOverlay";
