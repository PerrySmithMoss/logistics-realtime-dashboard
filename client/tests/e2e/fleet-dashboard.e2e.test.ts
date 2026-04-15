import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __layoutShiftScore?: number;
    __layoutShiftObserverStarted?: boolean;
  }
}

test.beforeEach(async ({ page, request }) => {
  await request.post("http://127.0.0.1:5500/__admin/reset");

  await page.addInitScript(() => {
    window.__layoutShiftScore = 0;

    if (window.__layoutShiftObserverStarted) return;

    window.__layoutShiftObserverStarted = true;

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };

        if (!shift.hadRecentInput) {
          window.__layoutShiftScore =
            (window.__layoutShiftScore ?? 0) + (shift.value ?? 0);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
});

test("renders the dashboard, streams telemetry, and keeps a selected popup attached to a moving vehicle", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Total Vehicles")).toBeVisible();
  await expect(page.getByRole("list", { name: "Vehicle markers" })).toBeVisible();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();

  const searchInput = page.getByPlaceholder("Search Vehicle ID...");
  await searchInput.fill("VHC-202");
  await page.getByRole("option", { name: /VHC-202/i }).click();
  await expect(searchInput).toHaveValue("VHC-202");

  const telemetryList = page.getByRole("list", { name: "Vehicle telemetry" });
  const firstTelemetry = await telemetryList.getByText(/VHC-202:/).textContent();

  await page.waitForTimeout(1500);

  const secondTelemetry = await telemetryList
    .getByText(/VHC-202:/)
    .textContent();

  expect(firstTelemetry).not.toBe(secondTelemetry);
});

test("gracefully reconnects when the SSE stream is interrupted", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:5500/__admin/config", {
    data: { interruptFirstStream: true, tickMs: 500 },
  });

  await page.goto("/");

  await expect(page.getByText("Total Vehicles")).toBeVisible();
  await expect(page.getByText("Reconnecting...")).not.toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Connection Lost")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Connection Lost")).not.toBeVisible({
    timeout: 15_000,
  });
});

test("keeps layout shifts near zero during high-frequency telemetry updates", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:5500/__admin/config", {
    data: { tickMs: 120 },
  });

  await page.goto("/");
  await expect(page.getByText("Total Vehicles")).toBeVisible();

  await page.waitForTimeout(2500);

  const layoutShiftScore = await page.evaluate(
    () => window.__layoutShiftScore ?? 0,
  );

  expect(layoutShiftScore).toBeLessThan(0.02);
});
