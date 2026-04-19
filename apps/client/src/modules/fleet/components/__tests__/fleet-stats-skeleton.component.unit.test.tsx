import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FleetStatsSkeleton } from "../fleet-stats-skeleton.component";

describe("FleetStatsSkeleton", () => {
  it("renders the map loading placeholder and three stat cards", () => {
    const { container } = render(<FleetStatsSkeleton />);

    expect(screen.getByText("Initialising Map Engine...")).toBeInTheDocument();
    expect(container.querySelectorAll(".h-32")).toHaveLength(3);
  });
});
