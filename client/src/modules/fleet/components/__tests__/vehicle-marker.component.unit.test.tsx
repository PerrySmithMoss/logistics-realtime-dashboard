import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getVehicleMarkerStyles,
  VehicleMarker,
} from "../vehicle-marker.component";

describe("VehicleMarker", () => {
  it("renders the delayed marker tone and status metadata", () => {
    render(<VehicleMarker vehicleId="VHC-202" status="delayed" />);

    const marker = screen.getByRole("img", {
      name: "VHC-202 delayed vehicle marker",
    });

    expect(marker).toHaveAttribute("data-status", "delayed");
    expect(marker).toHaveClass(getVehicleMarkerStyles("delayed"));
  });

  it("renders the active marker tone", () => {
    render(<VehicleMarker vehicleId="VHC-101" status="active" />);

    expect(
      screen.getByRole("img", { name: "VHC-101 active vehicle marker" }),
    ).toHaveClass(getVehicleMarkerStyles("active"));
  });
});
