export class FleetStatsUpdatedEvent {
  static readonly type = "FLEET.STATS_UPDATED" as const;

  constructor(
    public readonly stats: {
      total: number;
      activeCount: number;
      performancePct: number;
    },
  ) {}
}
