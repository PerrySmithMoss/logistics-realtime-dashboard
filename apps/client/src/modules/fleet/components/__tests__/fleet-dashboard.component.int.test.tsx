import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import React from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  initialFleetSnapshot,
  updatedFleetSnapshot,
} from "../../../../../tests/mocks/fleet-fixtures";
import { TestSseStream } from "../../../../../tests/mocks/test-sse-stream";
import { server } from "../../../../../tests/setup/msw-server";
import { customRender } from "../../../../../tests/testing-utils";
import { FleetDashboard } from "../fleet-dashboard.component";

const mapTestState = vi.hoisted(() => ({
  mountCount: 0,
  unmountCount: 0,
  renderSpy: vi.fn(),
  zoomToVehicle: vi.fn(),
  openPopup: vi.fn(),
}));

vi.mock("../fleet-map.component", async () => {
  const ReactModule = await import("react");

  return {
    FleetMap: ReactModule.forwardRef(
      (
        { data }: { data: GeoJSON.FeatureCollection },
        ref: React.ForwardedRef<{
          zoomToVehicle: Mock;
          openPopup: Mock;
        }>,
      ) => {
        ReactModule.useEffect(() => {
          mapTestState.mountCount += 1;

          return () => {
            mapTestState.unmountCount += 1;
          };
        }, []);

        ReactModule.useImperativeHandle(ref, () => ({
          zoomToVehicle: mapTestState.zoomToVehicle,
          openPopup: mapTestState.openPopup,
        }));

        mapTestState.renderSpy(data.features.map((feature) => feature.properties?.id));

        return (
          <div data-testid="fleet-map-mock">
            <span data-testid="map-feature-count">{data.features.length}</span>
          </div>
        );
      },
    ),
  };
});

describe("FleetDashboard integration", () => {
  beforeEach(() => {
    mapTestState.mountCount = 0;
    mapTestState.unmountCount = 0;
    mapTestState.renderSpy.mockClear();
    mapTestState.zoomToVehicle.mockClear();
    mapTestState.openPopup.mockClear();
  });

  const mockStreamToken = () =>
    http.post("http://localhost:3000/api/fleet/stream-token", () =>
      Response.json({
        token: "signed-stream-token",
      }),
    );

  it("hydrates from the initial snapshot and applies streamed stats updates without remounting the map", async () => {
    const stream = new TestSseStream();

    server.use(
      mockStreamToken(),
      http.get("http://127.0.0.1:4000/api/v1/fleet/stream", ({ request }) => {
        expect(new URL(request.url).searchParams.get("token")).toBe("signed-stream-token");
        return stream.createResponse();
      }),
    );

    customRender(<FleetDashboard initialData={initialFleetSnapshot} />);

    expect(await screen.findByText("Total Vehicles")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Total Vehicles" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("33.3% of fleet")).toBeInTheDocument();

    await stream.waitUntilConnected();
    stream.emit("stats-update", updatedFleetSnapshot);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("66.7% of fleet")).toBeInTheDocument();
    });

    expect(screen.getByTestId("map-feature-count")).toHaveTextContent("3");
    expect(mapTestState.mountCount).toBe(1);
    expect(mapTestState.unmountCount).toBe(0);
  });

  it.each([429, 503])(
    "shows the connection error state when the stream returns %s",
    async (statusCode) => {
      server.use(
        mockStreamToken(),
        http.get(
          "http://127.0.0.1:4000/api/v1/fleet/stream",
          () => new Response(null, { status: statusCode }),
        ),
      );

      customRender(<FleetDashboard initialData={initialFleetSnapshot} />);

      expect(await screen.findByText("Connection Lost")).toBeInTheDocument();
    },
  );

  it("focuses the selected vehicle from search suggestions", async () => {
    vi.useFakeTimers();
    const stream = new TestSseStream();

    server.use(
      mockStreamToken(),
      http.get("http://127.0.0.1:4000/api/v1/fleet/stream", () => stream.createResponse()),
    );

    customRender(<FleetDashboard initialData={initialFleetSnapshot} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "202" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(mapTestState.zoomToVehicle).toHaveBeenCalledWith(
      initialFleetSnapshot.vehicles[1].lng,
      initialFleetSnapshot.vehicles[1].lat,
    );
    expect(mapTestState.openPopup).toHaveBeenCalledWith(initialFleetSnapshot.vehicles[1]);
  });

  it("focuses delayed vehicles when their overlay pill is clicked", () => {
    const stream = new TestSseStream();

    server.use(
      mockStreamToken(),
      http.get("http://127.0.0.1:4000/api/v1/fleet/stream", () => stream.createResponse()),
    );

    customRender(<FleetDashboard initialData={initialFleetSnapshot} />);

    fireEvent.click(screen.getByRole("button", { name: /vhc-202/i }));

    expect(mapTestState.zoomToVehicle).toHaveBeenCalledWith(
      initialFleetSnapshot.vehicles[1].lng,
      initialFleetSnapshot.vehicles[1].lat,
    );
    expect(mapTestState.openPopup).toHaveBeenCalledWith(initialFleetSnapshot.vehicles[1]);
  });

  it("throws when neither initial data prop is provided", () => {
    expect(() => render(<FleetDashboard />)).toThrow(
      "FleetDashboard requires initialData or initialDataPromise",
    );
  });
});
