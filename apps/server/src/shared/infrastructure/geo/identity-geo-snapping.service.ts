import {
  IGeoSnappingService,
  SnapRequest,
  SnapResponse,
} from "@shared/interfaces/geo-snapping-service.interface";

export class IdentityGeoSnappingService implements IGeoSnappingService {
  public async snapBatch(points: SnapRequest[]): Promise<SnapResponse[]> {
    return points.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      success: true,
    }));
  }
}
