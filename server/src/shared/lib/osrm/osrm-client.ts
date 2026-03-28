import { httpClient } from "../http";
import { OsrmNearestResponse } from "./osrm.types";

export class OsrmClient {
  constructor(
    private readonly baseUrl: string = "https://router.project-osrm.org",
  ) {}

  public async getNearest(
    lng: number,
    lat: number,
  ): Promise<OsrmNearestResponse | null> {
    const endpoint = `${this.baseUrl}/nearest/v1/driving/${lng},${lat}?number=1`;

    try {
      return await httpClient<OsrmNearestResponse>(endpoint, {
        label: "OSRM_Nearest",
        timeout: 3000,
        retries: 2,
        transform: false,
      });
    } catch (err) {
      // We log here, but let the caller decide if they want a fallback
      console.error("[OsrmClient] Failed to fetch nearest road:", err);
      return null;
    }
  }
}
