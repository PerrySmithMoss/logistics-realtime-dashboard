import { describe, expect, it } from "vitest";
import { transformToGeoJSON } from "./map-transformers";

describe("transformToGeoJSON", () => {
  it("maps fleet coordinates and status into GeoJSON features", () => {
    const result = transformToGeoJSON([
      {
        id: "VHC-101",
        plateNumber: "ABC123",
        lat: 51.5074,
        lng: -0.1278,
        status: "active",
        lastUpdated: "2026-04-14T08:00:00.000Z",
        isSnapped: true,
      },
    ]);

    expect(result).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [-0.1278, 51.5074],
          },
          properties: {
            id: "VHC-101",
            status: "active",
          },
        },
      ],
    });
  });
});
