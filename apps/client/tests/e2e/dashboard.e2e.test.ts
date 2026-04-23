import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __layoutShiftScore?: number;
    __layoutShiftObserverStarted?: boolean;
  }
}

test.beforeEach(async ({ page }) => {
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
          window.__layoutShiftScore = (window.__layoutShiftScore ?? 0) + (shift.value ?? 0);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
});

test.describe("Fleet Dashboard", () => {
  test("dashboard accurately reflects live simulator movement", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Total Vehicles")).toBeVisible();

    const vehicleId = "V-101";
    const telemetry = page.getByRole("listitem").filter({ hasText: `${vehicleId}:` });
    const initialCoords = await telemetry.innerText();

    await expect(async () => {
      const currentCoords = await telemetry.innerText();
      expect(currentCoords).not.toBe(initialCoords);
    }).toPass({ timeout: 5000 });
  });

  test("v-102 lifecycle: search, select, and verify map popup", async ({ page }) => {
    await page.goto("/");
    const vehicleId = "V-102";

    const mapCanvas = page.locator("canvas.maplibregl-canvas");
    await expect(mapCanvas).toBeVisible();

    await expect(page.getByRole("img", { name: "V-102 active vehicle marker" })).toBeAttached();

    const searchInput = page.getByPlaceholder("Search Vehicle ID...");
    await searchInput.fill(vehicleId);

    const option = page.getByRole("option", { name: new RegExp(vehicleId, "i") });
    await option.click();

    const popupContainer = page.locator(".maplibregl-popup");
    await expect(popupContainer).toBeVisible({ timeout: 10000 });

    const heading = popupContainer.getByRole("heading", { name: vehicleId });
    await expect(heading).toBeVisible();
  });

  test("handles SSE connection lifecycle and recovery", async ({ page }) => {
    await page.route("**/api/v1/fleet/stream?*", (route) => route.abort("failed"));

    await page.goto("/");

    const indicator = page.getByRole("status");

    await expect(indicator).toBeVisible({ timeout: 7000 });
    await expect(indicator).toContainText("Reconnecting...");

    await page.unroute("**/api/v1/fleet/stream?*");

    await expect(indicator).not.toBeVisible({ timeout: 10000 });
  });

  test("shows hard failure when server rejects connection", async ({ page }) => {
    await page.route("**/api/v1/fleet/stream?*", (route) =>
      route.fulfill({ status: 403, body: "Forbidden" }),
    );

    await page.goto("/");

    await expect(page.getByRole("status")).toContainText("Connection Lost");
    await expect(page.locator("role=status >> span")).toHaveClass(/bg-red-500/);
  });
});
