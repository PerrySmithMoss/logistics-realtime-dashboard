import { consoleLogger } from "@shared/infrastructure/logger";
import { IOsrmClient } from "@shared/interfaces/osrm-client-interface";
import { httpClient } from "../http";
import { OsrmNearestResponse } from "./osrm.types";

export class OsrmClient implements IOsrmClient {
  constructor(
    private readonly baseUrl: string = "https://router.project-osrm.org",
  ) {}

  public async getNearest(
    lat: number,
    lng: number,
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
      consoleLogger.error("[OsrmClient] Failed to fetch nearest road:", {
        error: err,
        coordinates: lat,
        lng,
      });
      return null;
    }
  }
}
