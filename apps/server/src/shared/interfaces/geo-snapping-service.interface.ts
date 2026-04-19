export interface SnapRequest {
  lat: number;
  lng: number;
}

export interface SnapResponse {
  lat: number;
  lng: number;
  success: boolean;
  streetName?: string;
}

export interface IGeoSnappingService {
  snapBatch(points: SnapRequest[], options?: { signal?: AbortSignal }): Promise<SnapResponse[]>;
}
