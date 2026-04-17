import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FleetSummaryCard } from "../fleet-summary-card.component";

describe("FleetSummaryCard", () => {
  it("calculates the fleet percentage accurately", () => {
    render(
      <FleetSummaryCard title="Delayed" count={2} total={5} variant="danger" />,
    );

    expect(screen.getByText("Delayed")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("40.0% of fleet")).toBeInTheDocument();
  });

  it("guards against divide-by-zero totals", () => {
    render(<FleetSummaryCard title="Delayed" count={0} total={0} />);

    expect(screen.getByText("0.0% of fleet")).toBeInTheDocument();
  });
});
