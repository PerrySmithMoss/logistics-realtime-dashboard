import { act, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initialFleetSnapshot,
  updatedFleetSnapshot,
} from "../../../../../tests/mocks/fleet-fixtures";
import { transformToGeoJSON } from "../../lib";
import { FleetMap } from "../fleet-map.component";

const sourceSetData = vi.fn();
const popupSetLngLat = vi.fn();
const popupSetHTML = vi.fn();
const popupAddTo = vi.fn(function (this: object) {
  return this;
});
const popupRemove = vi.fn();
const popupIsOpen = vi.fn(() => true);
const canvasStyle = { cursor: "" };

const mapState = {
  events: new Map<string, (...args: unknown[]) => void>(),
  layerEvents: new Map<string, (...args: unknown[]) => void>(),
  flyTo: vi.fn(),
  remove: vi.fn(),
  addImage: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  getCanvas: vi.fn(() => ({ style: canvasStyle })),
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
            mapState.layerEvents.set(
              `${event}:${layerOrHandler}`,
              maybeHandler as (...args: unknown[]) => void,
            );
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

describe("FleetMap", () => {
  const triggerMapLoad = async () => {
    await act(async () => {
      await mapState.events.get("load")?.();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mapState.events.clear();
    mapState.layerEvents.clear();
    canvasStyle.cursor = "";
  });

  it("renders screen-reader marker and telemetry fallbacks", () => {
    render(<FleetMap data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />);

    expect(screen.getByRole("list", { name: "Vehicle markers" })).toBeInTheDocument();
    expect(screen.getByText("VHC-101:active")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Vehicle telemetry" })).toBeInTheDocument();
    expect(screen.getByText(/VHC-202: 51\.5081, -0\.1251/)).toBeInTheDocument();
  });

  it("updates the underlying source data when fleet data changes after load", async () => {
    const { rerender } = render(
      <FleetMap data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />,
    );

    await triggerMapLoad();

    rerender(<FleetMap data={transformToGeoJSON(updatedFleetSnapshot.vehicles)} />);

    expect(sourceSetData).toHaveBeenCalledTimes(1);
    expect(sourceSetData).toHaveBeenCalledWith(transformToGeoJSON(updatedFleetSnapshot.vehicles));
  });

  it("exposes imperative focus and popup methods", async () => {
    const ref = React.createRef<{
      zoomToVehicle: (lng: number, lat: number) => void;
      openPopup: (vehicle: (typeof initialFleetSnapshot.vehicles)[number]) => void;
    }>();

    render(<FleetMap ref={ref} data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />);

    await triggerMapLoad();

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

  it("replays queued focus and popup actions after the map loads", async () => {
    const ref = React.createRef<{
      zoomToVehicle: (lng: number, lat: number) => void;
      openPopup: (vehicle: (typeof initialFleetSnapshot.vehicles)[number]) => void;
    }>();

    render(<FleetMap ref={ref} data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />);

    ref.current?.zoomToVehicle(-0.12, 51.5);
    ref.current?.openPopup(initialFleetSnapshot.vehicles[0]);

    expect(mapState.flyTo).not.toHaveBeenCalled();
    expect(popupSetLngLat).not.toHaveBeenCalled();

    await triggerMapLoad();

    expect(mapState.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-0.12, 51.5],
        zoom: 16,
      }),
    );
    expect(popupSetLngLat).toHaveBeenCalledWith([
      initialFleetSnapshot.vehicles[0].lng,
      initialFleetSnapshot.vehicles[0].lat,
    ]);
  });

  it("opens a popup from layer clicks and updates the cursor on hover", async () => {
    render(<FleetMap data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />);

    await triggerMapLoad();

    mapState.layerEvents.get("mouseenter:vehicle-layer")?.();
    expect(mapState.getCanvas().style.cursor).toBe("pointer");

    mapState.layerEvents.get("click:vehicle-layer")?.({
      features: [
        {
          properties: initialFleetSnapshot.vehicles[1],
          geometry: {
            type: "Point",
            coordinates: [
              initialFleetSnapshot.vehicles[1].lng,
              initialFleetSnapshot.vehicles[1].lat,
            ],
          },
        },
      ],
    });

    expect(popupSetLngLat).toHaveBeenCalledWith([
      initialFleetSnapshot.vehicles[1].lng,
      initialFleetSnapshot.vehicles[1].lat,
    ]);
    expect(popupSetHTML).toHaveBeenCalledWith("<p>VHC-202</p>");

    mapState.layerEvents.get("mouseleave:vehicle-layer")?.();
    expect(mapState.getCanvas().style.cursor).toBe("");
  });

  it("moves an open popup when live vehicle coordinates change", async () => {
    const { rerender } = render(
      <FleetMap data={transformToGeoJSON(initialFleetSnapshot.vehicles)} />,
    );

    await triggerMapLoad();

    mapState.layerEvents.get("click:vehicle-layer")?.({
      features: [
        {
          properties: initialFleetSnapshot.vehicles[1],
          geometry: {
            type: "Point",
            coordinates: [
              initialFleetSnapshot.vehicles[1].lng,
              initialFleetSnapshot.vehicles[1].lat,
            ],
          },
        },
      ],
    });

    const movedData = transformToGeoJSON(
      updatedFleetSnapshot.vehicles.map((vehicle) =>
        vehicle.id === "VHC-202" ? { ...vehicle, lng: -0.11, lat: 51.51 } : vehicle,
      ),
    );

    rerender(<FleetMap data={movedData} />);

    expect(popupSetLngLat).toHaveBeenLastCalledWith([-0.11, 51.51]);
    expect(popupSetHTML).toHaveBeenLastCalledWith("<p>VHC-202</p>");
  });

  it("skips malformed screen-reader features and cleans up the map on unmount", () => {
    const malformedData: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [0],
          },
          properties: {
            id: "BAD-1",
          },
        } as never,
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [],
          },
          properties: {
            status: "active",
          },
        } as never,
      ],
    };

    const { unmount } = render(<FleetMap data={malformedData} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/BAD-1:/)).not.toBeInTheDocument();

    unmount();

    expect(mapState.remove).toHaveBeenCalledTimes(1);
  });
});
