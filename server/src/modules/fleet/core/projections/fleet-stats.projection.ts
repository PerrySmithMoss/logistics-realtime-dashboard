export class FleetStatsProjection {
  private vehicleStates = new Map<string, string>();

  public handleUpdate(vehicleId: string, status: string): void {
    this.vehicleStates.set(vehicleId, status);
  }

  public getGlobalStats() {
    const allStatuses = Array.from(this.vehicleStates.values());
    const total = allStatuses.length;
    const activeCount = allStatuses.filter((s) => s === "active").length;

    return {
      total,
      activeCount,
      delayedCount: allStatuses.filter((s) => s === "delayed").length,
      performancePct: total > 0 ? (activeCount / total) * 100 : 0,
    };
  }
}
