"use client";

import { use, useCallback, useMemo, useRef, useState } from "react";
import { useFleetSSE } from "../hooks";
import { transformToGeoJSON } from "../lib";
import { FleetMapHandle, FleetSnapshot, FleetVehicle } from "../types";
import {
  FleetDashboardStatCard,
  FleetMap,
  FleetMapErrorBoundary,
  FleetMapOverlay,
  FleetMapSearch,
  FleetSummaryCard,
} from "./";

interface FleetDashboardProps {
  initialDataPromise?: Promise<FleetSnapshot>;
  initialData?: FleetSnapshot;
}

export const FleetDashboard = ({
  initialDataPromise,
  initialData: initialDataOverride,
}: FleetDashboardProps) => {
  if (!initialDataOverride && !initialDataPromise) {
    throw new Error("FleetDashboard requires initialData or initialDataPromise");
  }

  const initialData = initialDataOverride ?? use(initialDataPromise!);
  const mapRef = useRef<FleetMapHandle>(null);
  const [data, setData] = useState<FleetSnapshot>(initialData);
  const [activeMobilePanel, setActiveMobilePanel] = useState<"search" | "insights" | null>(null);

  const { status: sseStatus } = useFleetSSE(setData);

  const { geoJSON, delayedVehicles } = useMemo(() => {
    return {
      geoJSON: transformToGeoJSON(data.vehicles),
      delayedVehicles: data.vehicles?.filter((v) => v.status === "delayed"),
    };
  }, [data.vehicles]);

  const focusOnVehicle = useCallback((vehicle: FleetVehicle) => {
    mapRef.current?.zoomToVehicle(vehicle.lng, vehicle.lat);
    mapRef.current?.openPopup(vehicle);
  }, []);

  const handleSearch = useCallback(
    (vehicleId: string) => {
      const vehicle = data.vehicles?.find((v) => v.id.toLowerCase() === vehicleId.toLowerCase());

      if (!vehicle) return;

      focusOnVehicle(vehicle);
      setActiveMobilePanel(null);
    },
    [data.vehicles, focusOnVehicle],
  );

  const handleVehicleFocus = useCallback(
    (vehicle: FleetVehicle) => {
      focusOnVehicle(vehicle);
      setActiveMobilePanel(null);
    },
    [focusOnVehicle],
  );

  return (
    <div className="flex h-full flex-col bg-slate-50 p-0 md:space-y-4 md:p-6">
      <section aria-label="Fleet summary" className="hidden shrink-0 grid-cols-3 gap-4 md:grid">
        <FleetDashboardStatCard title="Total Vehicles" value={data.summary.total.toString()} />
        <FleetDashboardStatCard
          title="Performance"
          value={`${data.summary.performancePct.toFixed(1)}%`}
          variant={data.summary.performancePct < 80 ? "warning" : "default"}
        />
        <FleetSummaryCard
          title="Delayed"
          count={data.summary.delayedCount}
          total={data.summary.total}
          variant={data.summary.delayedCount > 0 ? "danger" : "default"}
        />
      </section>
      <section aria-label="Fleet workspace" className="flex flex-1 md:gap-4">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm">
          <FleetMapSearch
            onSearch={handleSearch}
            vehicles={data.vehicles}
            className="absolute left-3 right-3 top-3 z-20 hidden md:block md:left-6 md:right-auto md:top-6 md:w-72"
          />

          <FleetMapErrorBoundary>
            <FleetMap ref={mapRef} data={geoJSON} />
          </FleetMapErrorBoundary>

          <div className="hidden md:block">
            <FleetMapOverlay
              sseStatus={sseStatus}
              delayedVehicles={delayedVehicles}
              onVehicleClick={handleVehicleFocus}
            />
          </div>

          <div className="absolute inset-x-3 top-3 z-30 md:hidden">
            {activeMobilePanel === "search" ? (
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur-md">
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Search Fleet
                  </p>
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={() => setActiveMobilePanel(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <FleetMapSearch
                  onSearch={handleSearch}
                  vehicles={data.vehicles}
                  className="w-full"
                />
              </div>
            ) : activeMobilePanel === "insights" ? (
              <div className="mx-auto max-w-sm">
                <div className="mb-2 flex items-center justify-end">
                  <button
                    type="button"
                    aria-label="Close live info"
                    onClick={() => setActiveMobilePanel(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-lg backdrop-blur-md"
                  >
                    <CloseIcon />
                  </button>
                </div>
                <FleetMapOverlay
                  sseStatus={sseStatus}
                  delayedVehicles={delayedVehicles}
                  onVehicleClick={handleVehicleFocus}
                  variant="panel"
                />
              </div>
            ) : null}
          </div>

          <div className="absolute left-3 right-3 top-3 z-20 flex items-start justify-between md:hidden">
            <button
              type="button"
              aria-label={activeMobilePanel === "search" ? "Close search" : "Open search"}
              aria-pressed={activeMobilePanel === "search"}
              onClick={() =>
                setActiveMobilePanel((current) => (current === "search" ? null : "search"))
              }
              className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-colors ${
                activeMobilePanel === "search"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white/95 text-slate-700"
              }`}
            >
              <SearchToggleIcon />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={activeMobilePanel === "insights" ? "Close live info" : "Open live info"}
                aria-pressed={activeMobilePanel === "insights"}
                onClick={() =>
                  setActiveMobilePanel((current) => (current === "insights" ? null : "insights"))
                }
                className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-colors ${
                  activeMobilePanel === "insights"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white/95 text-slate-700"
                }`}
              >
                <InfoIcon />
              </button>
              {activeMobilePanel !== "insights" ? (
                <div className="rounded-full border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md">
                  <span className="text-[11px] font-semibold text-slate-600">
                    {statusLabel(sseStatus)}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const statusLabel = (status: string) => {
  switch (status) {
    case "connecting":
      return "Reconnecting";
    case "error":
      return "Offline";
    default:
      return "Live";
  }
};

const SearchToggleIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);

const InfoIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v6" />
    <path d="M12 7.5h.01" />
  </svg>
);

const CloseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
    <path d="M6 6 18 18" />
    <path d="M18 6 6 18" />
  </svg>
);
