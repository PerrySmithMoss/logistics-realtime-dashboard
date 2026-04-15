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

  const { status: sseStatus } = useFleetSSE(setData);

  const { geoJSON, delayedVehicles } = useMemo(() => {
    return {
      geoJSON: transformToGeoJSON(data.vehicles),
      delayedVehicles: data.vehicles.filter((v) => v.status === "delayed"),
    };
  }, [data.vehicles]);

  const focusOnVehicle = useCallback((vehicle: FleetVehicle) => {
    mapRef.current?.zoomToVehicle(vehicle.lng, vehicle.lat);
    mapRef.current?.openPopup(vehicle);
  }, []);

  const handleSearch = useCallback(
    (vehicleId: string) => {
      const vehicle = data.vehicles.find(
        (v) => v.id.toLowerCase() === vehicleId.toLowerCase(),
      );

      if (!vehicle) return;

      focusOnVehicle(vehicle);
    },
    [data.vehicles, focusOnVehicle],
  );

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50">
      <section
        aria-label="Fleet summary"
        className="grid grid-cols-3 gap-4 shrink-0"
      >
        <FleetDashboardStatCard
          title="Total Vehicles"
          value={data.summary.total.toString()}
        />
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
      <section
        aria-label="Fleet map"
        className="flex-1 relative border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden"
      >
        <FleetMapSearch onSearch={handleSearch} vehicles={data.vehicles} />

        <FleetMapErrorBoundary>
          <FleetMap ref={mapRef} data={geoJSON} />
        </FleetMapErrorBoundary>

        <FleetMapOverlay
          sseStatus={sseStatus}
          delayedVehicles={delayedVehicles}
          onVehicleClick={focusOnVehicle}
        />
      </section>
    </div>
  );
};
