import {
  IGeoSnappingService,
  SnapRequest,
  SnapResponse,
} from "@shared/interfaces/geo-snapping-service.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { httpClient } from "@shared/lib/http";

export class OpenRouteServiceClient implements IGeoSnappingService {
  private readonly orsUrl =
    "https://api.openrouteservice.org/v2/snap/driving-car";

  constructor(
    private readonly apiKey: string,
    private readonly logger: ILogger,
  ) {}

  public async snapBatch(points: SnapRequest[]): Promise<SnapResponse[]> {
    try {
      const locations = points.map((p) => [p.lng, p.lat]);

      const response = await httpClient<any>(this.orsUrl, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locations, radius: 350 }),
        label: "ORS_BATCH_SNAP",
      });

      if (!response || !response.locations) {
        this.logger.warn(
          "[ORSClient] API returned success but empty/invalid payload",
          { response },
        );
        return points.map((p) => ({ ...p, success: false }));
      }

      return response.locations.map((item: any, index: number) => {
        const original = points[index];

        const [lng, lat] = item.location;

        const success =
          Math.abs(lat - original.lat) > 0.00001 ||
          Math.abs(lng - original.lng) > 0.00001;

        return {
          lat,
          lng,
          success,
          streetName: item.name || undefined,
        };
      });
    } catch (err) {
      this.logger.error("[ORSClient] Batch snapping failed", err);
      return points.map((p) => ({ ...p, success: false }));
    }
  }
}
