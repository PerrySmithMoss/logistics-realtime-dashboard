import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FleetMapSearch } from "../fleet-map-search.component";

const vehicles = [
  { id: "VHC-101", status: "active" as const },
  { id: "VHC-202", status: "delayed" as const },
  { id: "VHC-303", status: "active" as const },
  { id: "VHC-404", status: "maintenance" as const },
  { id: "VHC-505", status: "inactive" as const },
  { id: "TRK-606", status: "active" as const },
];

describe("FleetMapSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (vi.isFakeTimers()) {
      await vi.runOnlyPendingTimersAsync();
    }
    vi.useRealTimers();
  });

  it("shows the first five vehicles when the query is empty", () => {
    render(<FleetMapSearch onSearch={vi.fn()} vehicles={vehicles} />);

    fireEvent.focus(screen.getByPlaceholderText("Search Vehicle ID..."));

    expect(screen.getAllByRole("option")).toHaveLength(5);
    expect(screen.getByText("VHC-101")).toBeInTheDocument();
    expect(screen.queryByText("TRK-606")).not.toBeInTheDocument();
  });

  it("filters suggestions after the debounce and submits the top match on enter", async () => {
    const onSearch = vi.fn();

    render(<FleetMapSearch onSearch={onSearch} vehicles={vehicles} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.change(input, { target: { value: "202" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSearch).toHaveBeenCalledWith("VHC-202");
  });

  it("supports keyboard navigation across suggestions", async () => {
    const onSearch = vi.fn();

    render(<FleetMapSearch onSearch={onSearch} vehicles={vehicles} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "VHC" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSearch).toHaveBeenCalledWith("VHC-202");
  });

  it("closes the menu when escape is pressed", async () => {
    render(<FleetMapSearch onSearch={vi.fn()} vehicles={vehicles} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "VHC" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps the first option selected when arrow-up is pressed from the top", async () => {
    const onSearch = vi.fn();

    render(<FleetMapSearch onSearch={onSearch} vehicles={vehicles} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "VHC" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSearch).toHaveBeenCalledWith("VHC-101");
  });

  it("shows an empty state when no vehicles match the query", async () => {
    render(<FleetMapSearch onSearch={vi.fn()} vehicles={vehicles} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ZZZ" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(screen.getByText("No vehicles found.")).toBeInTheDocument();
  });

  it("does not submit when enter is pressed without any matching suggestions", async () => {
    const onSearch = vi.fn();

    render(<FleetMapSearch onSearch={onSearch} vehicles={vehicles} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "ZZZ" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSearch).not.toHaveBeenCalled();
  });

  it("keeps option selection working during the delayed blur close", async () => {
    const onSearch = vi.fn();

    render(<FleetMapSearch onSearch={onSearch} vehicles={vehicles} />);

    const input = screen.getByPlaceholderText("Search Vehicle ID...");

    fireEvent.focus(input);
    fireEvent.blur(input);
    fireEvent.mouseDown(screen.getByRole("button", { name: /vhc-101/i }));

    expect(onSearch).toHaveBeenCalledWith("VHC-101");
  });
});
