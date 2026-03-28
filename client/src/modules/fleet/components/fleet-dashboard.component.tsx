"use client";

import { use, useCallback, useRef, useState } from "react";
import { useFleetSSE } from "../hooks";
import { transformToGeoJSON } from "../lib/map-transformers";
import { FleetMapSearch } from "./fleet-map-search.component";
import { FleetMap } from "./fleet-map.component";

export const FleetDashboard = ({
  initialDataPromise,
}: {
  initialDataPromise: Promise<any>;
}) => {
  const initialData = use(initialDataPromise);
  const mapRef = useRef<any>(null);
  const [data, setData] = useState(initialData);

  useFleetSSE(useCallback((newData: any) => setData(newData), []));

  const focusOnVehicle = (v: any) => {
    mapRef.current?.zoomToVehicle(v.lng, v.lat);
    mapRef.current?.openPopup(v);
  };

  const handleSearch = (vehicleId: string) => {
    const vehicle = data.vehicles.find(
      (v: any) => v.id.toLowerCase() === vehicleId.toLowerCase(),
    );

    if (vehicle) {
      focusOnVehicle(vehicle);
    } else {
      // Small UX touch: visual feedback for no result
      console.warn("Vehicle not found");
    }
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50">
      {/* Stats Section */}
      <section className="grid grid-cols-3 gap-4 shrink-0">
        <StatCard title="Total Vehicles" value={data?.summary?.total} />
        <StatCard
          title="Performance"
          value={`${data?.summary?.performancePct?.toFixed(1)}%`}
          highlight={data?.summary?.performancePct < 80}
        />
        <StatCard
          title="Delayed"
          value={data?.summary?.delayedCount}
          color="red"
        />
      </section>

      <section className="flex-1 relative border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        <FleetMapSearch onSearch={handleSearch} vehicles={data.vehicles} />

        <FleetMap ref={mapRef} data={transformToGeoJSON(data?.vehicles)} />

        {/* Delayed vehicle navigation */}
        <div className="absolute bottom-6 left-6 right-24 flex gap-2 overflow-x-auto no-scrollbar pointer-events-none pb-2">
          {data.vehicles
            .filter((v: any) => v.status === "delayed")
            .map((v: any) => (
              <button
                key={v.id}
                onClick={() => focusOnVehicle(v)}
                className="pointer-events-auto cursor-pointer shrink-0 bg-white border border-red-100 px-3 py-2 rounded-xl shadow-lg text-red-600 text-xs font-bold hover:bg-red-50 transition-all active:scale-95"
              >
                ⚠️ {v.id}
              </button>
            ))}
        </div>

        {/* Legend */}
        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-xl border border-slate-200 z-10">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">
            Live Fleet Status
          </h4>
          <div className="space-y-3">
            <LegendItem color="#10b981" label="Active" />
            <LegendItem color="#ef4444" label="Delayed" />
          </div>
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ title, value, highlight, color }: any) => (
  <div
    className={`p-4 rounded-lg shadow border ${highlight ? "border-red-500 bg-red-50" : "bg-white"}`}
  >
    <h3 className="text-sm font-medium text-gray-500">{title}</h3>
    <p
      className={`text-2xl font-bold ${color === "red" ? "text-red-600" : "text-slate-900"}`}
      suppressHydrationWarning
    >
      {value}
    </p>
  </div>
);

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-3">
    <span
      className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
      style={{ backgroundColor: color }}
    />
    <span className="text-xs font-bold text-slate-600">{label}</span>
  </div>
);
