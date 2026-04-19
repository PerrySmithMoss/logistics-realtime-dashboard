import { VehicleSnapshot } from "@modules/vehicle/core/dtos";

export class FleetStatsUpdatedEvent {
  static readonly type = "FLEET.STATS_UPDATED" as const;

  constructor(
    public readonly payload: {
      summary: {
        total: number;
        activeCount: number;
        delayedCount: number;
        performancePct: number;
      };
      vehicles: VehicleSnapshot[];
    },
  ) {}
}
