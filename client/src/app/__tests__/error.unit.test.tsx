import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  critical: vi.fn(),
  withContext: vi.fn(),
};

describe("App ErrorPage", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock("@/config/client-env");
    vi.doUnmock("@/shared/errors");
    vi.doUnmock("@/shared/infrastructure");
  });

  it("shows the friendly message and avoids dev logging outside development", async () => {
    vi.doMock("@/config/client-env", () => ({
      clientEnv: {
        NEXT_PUBLIC_NODE_ENV: "test",
      },
    }));

    vi.doMock("@/shared/errors", () => ({
      getFriendlyErrorMessage: vi.fn(() => "Unable to reach an external service."),
    }));

    vi.doMock("@/shared/infrastructure", () => ({
      createLogger: () => logger,
    }));

    const { default: ErrorPage } = await import("../error");
    const reset = vi.fn();

    render(
      <ErrorPage
        error={Object.assign(new Error("Hidden dev message"), { digest: "digest-123" })}
        reset={reset}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Unable to reach an external service.",
    );
    expect(screen.getByText("ID: digest-123")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("shows the raw error and logs diagnostic details in development", async () => {
    vi.doMock("@/config/client-env", () => ({
      clientEnv: {
        NEXT_PUBLIC_NODE_ENV: "development",
      },
    }));

    vi.doMock("@/shared/errors", () => ({
      getFriendlyErrorMessage: vi.fn(() => "friendly fallback"),
    }));

    vi.doMock("@/shared/infrastructure", () => ({
      createLogger: () => logger,
    }));

    const { default: ErrorPage } = await import("../error");
    const error = Object.assign(new Error("Exploded in dev"), { digest: "digest-dev" });

    render(<ErrorPage error={error} reset={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Exploded in dev");
    expect(logger.error).toHaveBeenCalledWith(
      "Application crashed inside boundary",
      expect.objectContaining({
        message: "Exploded in dev",
        digest: "digest-dev",
      }),
    );
  });
});
