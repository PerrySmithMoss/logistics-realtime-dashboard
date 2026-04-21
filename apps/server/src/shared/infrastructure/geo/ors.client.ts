import {
  IGeoSnappingService,
  SnapRequest,
  SnapResponse,
} from "@shared/interfaces/geo-snapping-service.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { httpClient } from "@shared/lib/http";

interface ORSResponse {
  locations: Array<{
    location: [number, number];
    name?: string;
    distance?: number;
  }>;
}

export class OpenRouteServiceClient implements IGeoSnappingService {
  private readonly orsUrl = "https://api.openrouteservice.org/v2/snap/driving-car";

  constructor(
    private readonly apiKey: string,
    private readonly logger: ILogger,
    private readonly settings: {
      timeoutMs: number;
      retries: number;
      retryDelayMs: number;
      batchMaxSize: number;
      snapRadiusMeters: number;
    } = {
      timeoutMs: 15000,
      retries: 1,
      retryDelayMs: 750,
      batchMaxSize: 50,
      snapRadiusMeters: 350,
    },
  ) {}

  public async snapBatch(
    points: SnapRequest[],
    options?: { signal?: AbortSignal },
  ): Promise<SnapResponse[]> {
    try {
      const responses: SnapResponse[] = [];

      for (let start = 0; start < points.length; start += this.settings.batchMaxSize) {
        const batch = points.slice(start, start + this.settings.batchMaxSize);
        const snapped = await this.snapChunk(batch, options?.signal);
        responses.push(...snapped);
      }

      return responses;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        this.logger.info("[ORSClient] Request cancelled by Lifecycle Manager");
      } else {
        this.logger.error("[ORSClient] Batch snapping failed", {
          error: err,
          timeoutMs: this.settings.timeoutMs,
          retries: this.settings.retries,
          batchMaxSize: this.settings.batchMaxSize,
          pointCount: points.length,
        });
      }

      return points.map((p) => ({ ...p, success: false }));
    }
  }

  private async snapChunk(points: SnapRequest[], signal?: AbortSignal): Promise<SnapResponse[]> {
    const locations = points.map((p) => [p.lng, p.lat]);

    const response = await httpClient<ORSResponse>(this.orsUrl, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ locations, radius: this.settings.snapRadiusMeters }),
      label: "ORS_BATCH_SNAP",
      signal,
      timeout: this.settings.timeoutMs,
      retries: this.settings.retries,
      initialRetryDelay: this.settings.retryDelayMs,
      allowRetry: true,
    });

    if (!this.isORSResponse(response)) {
      this.logger.warn("[ORSClient] API returned success but empty/invalid payload", {
        response,
        pointCount: points.length,
      });
      return points.map((p) => ({ ...p, success: false }));
    }

    return response.locations.map((item, index) => {
      const original = points[index];

      const [lng, lat] = item.location;

      const success =
        Math.abs(lat - original.lat) > 0.00001 || Math.abs(lng - original.lng) > 0.00001;

      return {
        lat,
        lng,
        success,
        streetName: item.name || undefined,
      };
    });
  }

  private isORSResponse(data: unknown): data is ORSResponse {
    return (
      typeof data === "object" &&
      data !== null &&
      "locations" in data &&
      Array.isArray((data as ORSResponse).locations)
    );
  }
}
