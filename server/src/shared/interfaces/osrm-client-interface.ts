import { OsrmNearestResponse } from "@shared/lib/osrm";

export interface IOsrmClient {
  getNearest(
    lng: number,
    lat: number,
    options?: { signal?: AbortSignal },
  ): Promise<OsrmNearestResponse | null>;
}
