import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { initialFleetSnapshot } from "../../../../../tests/mocks/fleet-fixtures";
import { FleetDashboard } from "../fleet-dashboard.component";

vi.mock("../index", () => ({
  FleetDashboardStatCard: ({ title, value }: { title: string; value: string }) => (
    <div>{`${title}:${value}`}</div>
  ),
  FleetSummaryCard: ({ title, count, total }: { title: string; count: number; total: number }) => (
    <div>{`${title}:${count}/${total}`}</div>
  ),
  FleetMapSearch: () => <div data-testid="fleet-map-search" />,
  FleetMapErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FleetMap: () => <div data-testid="fleet-map" />,
  FleetMapOverlay: () => <div data-testid="fleet-map-overlay" />,
}));

vi.mock("../../hooks", () => ({
  useFleetSSE: () => ({ status: "connected" }),
}));

describe("FleetDashboard unit", () => {
  it("renders from an initial data promise when wrapped in suspense", async () => {
    await act(async () => {
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <FleetDashboard initialDataPromise={Promise.resolve(initialFleetSnapshot)} />
        </React.Suspense>,
      );
      await Promise.resolve();
    });

    expect(await screen.findByText("Total Vehicles:3")).toBeInTheDocument();
    expect(screen.getByText("Performance:66.7%")).toBeInTheDocument();
    expect(screen.getByText("Delayed:1/3")).toBeInTheDocument();
    expect(screen.getByTestId("fleet-map")).toBeInTheDocument();
  });
});
