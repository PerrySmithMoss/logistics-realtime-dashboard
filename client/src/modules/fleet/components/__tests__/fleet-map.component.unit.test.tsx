import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { initialFleetSnapshot, updatedFleetSnapshot } from "../../../../../tests/mocks/fleet-fixtures";
import { transformToGeoJSON } from "../../lib";

const sourceSetData = vi.fn();
const popupSetLngLat = vi.fn();
const popupSetHTML = vi.fn();
const popupAddTo = vi.fn(function (this: object) {
  return this;
});
const popupRemove = vi.fn();
const popupIsOpen = vi.fn(() => true);

const mapState = {
  events: new Map<string, (...args: unknown[]) => void>(),
  layerEvents: new Map<string, (...args: unknown[]) => void>(),
  flyTo: vi.fn(),
  remove: vi.fn(),
  addImage: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getCanvas: vi.fn(() => ({ style: { cursor: "" } })),
  getSource: vi.fn(() => ({ setData: sourceSetData })),
  isStyleLoaded: vi.fn(() => true),
};

vi.mock("maplibre-gl", () => ({
  default: {
    Map: vi.fn().mockImplementation(function () {
      return {
      ...mapState,
      on: vi.fn((event: string, layerOrHandler: unknown, maybeHandler?: unknown) => {
        if (typeof layerOrHandler === "string") {
          mapState.layerEvents.set(`${event}:${layerOrHandler}`, maybeHandler as (...args: unknown[]) => void);
          return;
        }

        mapState.events.set(event, layerOrHandler as (...args: unknown[]) => void);
      }),
    };
    }),
    Popup: vi.fn().mockImplementation(function () {
      return {
      setLngLat: popupSetLngLat.mockReturnThis(),
      setHTML: popupSetHTML.mockReturnThis(),
      addTo: popupAddTo,
      remove: popupRemove,
      isOpen: popupIsOpen,
      _vehicleId: undefined,
    };
    }),
  },
}));

vi.mock("../../lib/fleet-map.utils", () => ({
  buildPopupHtml: vi.fn((vehicle) => `<p>${vehicle.id}</p>`),
  loadVehicleIcon: vi.fn().mockResolvedValue("icon"),
}));

vi.mock("../vehicle-marker.component", () => ({
  VehicleMarker: ({ vehicleId, status }: { vehicleId: string; status: string }) => (
    <span>
      {vehicleId}:{status}
    </span>
  ),
}));

import { FleetMap } from "../fleet-map.component";

describe("FleetMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapState.events.clear();
    mapState.layerEvents.clear();
  });

  it("renders screen-reader marker and telemetry fallbacks", () => {
    render(<FleetMap data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />);

    expect(screen.getByRole("list", { name: "Vehicle markers" })).toBeInTheDocument();
    expect(screen.getByText("VHC-101:active")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Vehicle telemetry" })).toBeInTheDocument();
    expect(screen.getByText(/VHC-202: 51\.5081, -0\.1251/)).toBeInTheDocument();
  });

  it("updates the underlying source data when fleet data changes after load", async () => {
    const { rerender } = render(<FleetMap data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />);

    await mapState.events.get("load")?.();

    rerender(<FleetMap data={transformToGeoJSON(updatedFleetSnapshot.vehicles)} />);

    expect(sourceSetData).toHaveBeenCalledTimes(1);
    expect(sourceSetData).toHaveBeenCalledWith(transformToGeoJSON(updatedFleetSnapshot.vehicles));
  });

  it("exposes imperative focus and popup methods", async () => {
    const ref = React.createRef<{ zoomToVehicle: (lng: number, lat: number) => void; openPopup: (vehicle: (typeof initialFleetSnapshot.vehicles)[number]) => void }>();

    render(<FleetMap ref={ref} data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />);
    await mapState.events.get("load")?.();

    ref.current?.zoomToVehicle(-0.1234, 51.5092);
    ref.current?.openPopup(initialFleetSnapshot.vehicles[1]);

    expect(mapState.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-0.1234, 51.5092],
        zoom: 16,
      }),
    );
    expect(popupSetLngLat).toHaveBeenCalledWith([
      initialFleetSnapshot.vehicles[1].lng,
      initialFleetSnapshot.vehicles[1].lat,
    ]);
  });
});
