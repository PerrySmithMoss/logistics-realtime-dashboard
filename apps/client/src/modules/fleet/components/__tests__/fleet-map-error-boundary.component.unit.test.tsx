import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
  withContext: vi.fn(),
}));

vi.mock("@/shared/infrastructure", () => ({
  createLogger: () => logger,
}));

import { FleetMapErrorBoundary } from "../fleet-map-error-boundary.component";

const Thrower = ({ error }: { error: Error }) => {
  throw error;
};

describe("FleetMapErrorBoundary", () => {
  const installReloadSpy = () => {
    const reloadSpy = vi.fn();

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        reload: reloadSpy,
      },
    });

    return reloadSpy;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("renders the recovery UI and resets after a normal render failure", () => {
    const reloadSpy = installReloadSpy();

    const { rerender } = render(
      <FleetMapErrorBoundary>
        <Thrower error={new Error("Map engine blew up")} />
      </FleetMapErrorBoundary>,
    );

    expect(screen.getByText("Map rendering failed")).toBeInTheDocument();
    expect(logger.error).toHaveBeenCalledWith(
      "Map Engine Crash",
      expect.objectContaining({
        message: "Map engine blew up",
      }),
    );

    rerender(
      <FleetMapErrorBoundary>
        <div>Map Restored</div>
      </FleetMapErrorBoundary>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(screen.getByText("Map Restored")).toBeInTheDocument();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("reloads the page for chunk loading failures", () => {
    const reloadSpy = installReloadSpy();

    render(
      <FleetMapErrorBoundary>
        <Thrower error={new Error("Loading chunk 12 failed")} />
      </FleetMapErrorBoundary>,
    );

    expect(logger.warn).toHaveBeenCalledWith("Chunk load failure detected. Refreshing assets...");
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
