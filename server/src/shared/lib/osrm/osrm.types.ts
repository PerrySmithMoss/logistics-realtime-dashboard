export interface OsrmNearestResponse {
  code: string;
  waypoints: Array<{
    location: [number, number]; // [lng, lat]
    name: string;
  }>;
}
