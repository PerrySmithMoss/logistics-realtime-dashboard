import { describe, expect, it } from "vitest";
import { buildPopupHtml, buildVehicleSvg } from "./fleet-map.utils";

describe("fleet map utils", () => {
  it("buildVehicleSvg applies the requested fill color", () => {
    expect(buildVehicleSvg("#ff0000")).toContain('fill="#ff0000"');
  });

  it("buildPopupHtml includes the vehicle id and status styling", () => {
    const html = buildPopupHtml({ id: "VHC-202", status: "delayed" });

    expect(html).toContain("VHC-202");
    expect(html).toContain("DELAYED");
    expect(html).toContain("text-red-500");
  });
});
