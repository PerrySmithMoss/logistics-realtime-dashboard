import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";

const testState = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  dashboardSpy: vi.fn(),
}));

vi.mock("@/modules/fleet/services/fleet.service", () => ({
  fleetService: {
    getSnapshot: testState.getSnapshot,
  },
}));

vi.mock("@/modules/fleet/components", () => ({
  FleetDashboard: ({ initialDataPromise }: { initialDataPromise: Promise<unknown> }) => {
    testState.dashboardSpy(initialDataPromise);
    return <div data-testid="fleet-dashboard" />;
  },
  FleetStatsSkeleton: () => <div data-testid="fleet-stats-skeleton" />,
}));

import HomePage, { dynamic } from "../page";

describe("HomePage", () => {
  it("forces dynamic rendering", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("starts loading the fleet snapshot and passes the promise into FleetDashboard", () => {
    const snapshotPromise = Promise.resolve({ summary: {}, vehicles: [] });
    testState.getSnapshot.mockReturnValueOnce(snapshotPromise);

    render(<HomePage />);

    expect(testState.getSnapshot).toHaveBeenCalledTimes(1);
    expect(testState.dashboardSpy).toHaveBeenCalledWith(snapshotPromise);
    expect(screen.getByTestId("fleet-dashboard")).toBeInTheDocument();
  });
});
