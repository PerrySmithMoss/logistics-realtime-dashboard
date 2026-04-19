import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FleetDashboardStatCard } from "../fleet-dashboard-stat-card.component";

describe("FleetDashboardStatCard", () => {
  it("renders the supplied title and value", () => {
    render(<FleetDashboardStatCard title="Total Vehicles" value="24" />);

    expect(screen.getByRole("heading", { level: 3, name: "Total Vehicles" })).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("applies warning styling when requested", () => {
    render(<FleetDashboardStatCard title="Performance" value="79.0%" variant="warning" />);

    expect(screen.getByText("79.0%").parentElement).toHaveClass("bg-amber-50");
  });
});
