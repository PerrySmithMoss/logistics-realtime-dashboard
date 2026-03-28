export const transformToGeoJSON = (
  vehicles: Vehicle[],
): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: vehicles?.map((v) => ({
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
