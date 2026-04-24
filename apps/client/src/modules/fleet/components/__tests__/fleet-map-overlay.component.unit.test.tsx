import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FleetMapOverlay } from "../fleet-map-overlay.component";

const delayedVehicle = {
  id: "VHC-202",
  plateNumber: "VHC-202-PLATE",
  lat: 51.5,
  lng: -0.12,
  status: "delayed" as const,
  lastUpdated: "2026-04-14T08:00:00.000Z",
  isSnapped: true,
};

describe("FleetMapOverlay", () => {
  it("shows the reconnecting indicator while the stream is connecting", () => {
    render(
      <FleetMapOverlay sseStatus="connecting" delayedVehicles={[]} onVehicleClick={vi.fn()} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Reconnecting...");
  });

  it("shows the live indicator when the stream is connected", () => {
    render(<FleetMapOverlay sseStatus="connected" delayedVehicles={[]} onVehicleClick={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Live");
  });

  it("shows the connection lost indicator when the stream errors", () => {
    render(<FleetMapOverlay sseStatus="error" delayedVehicles={[]} onVehicleClick={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Connection Lost");
  });

  it("renders delayed vehicle pills and forwards clicks", () => {
    const onVehicleClick = vi.fn();

    render(
      <FleetMapOverlay
        sseStatus="connected"
        delayedVehicles={[delayedVehicle]}
        onVehicleClick={onVehicleClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /vhc-202/i }));

    expect(screen.getByRole("status")).toHaveTextContent("Live");
    expect(onVehicleClick).toHaveBeenCalledWith(delayedVehicle);
  });

  it("renders a stacked panel variant for mobile controls", () => {
    render(
      <FleetMapOverlay
        sseStatus="connected"
        delayedVehicles={[delayedVehicle]}
        onVehicleClick={vi.fn()}
        variant="panel"
      />,
    );

    expect(screen.getByText("Delayed Vehicles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /vhc-202/i })).toBeInTheDocument();
  });
});
