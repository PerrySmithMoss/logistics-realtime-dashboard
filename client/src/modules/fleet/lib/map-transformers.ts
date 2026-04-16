import { FleetVehicle } from "../types";

export const transformToGeoJSON = (vehicles: FleetVehicle[] = []): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: vehicles.map((v) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [v.lng, v.lat],
    },
    properties: {
      id: v.id,
      status: v.status,
    },
  })),
});
