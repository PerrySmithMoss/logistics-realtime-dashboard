import { UpdateVehicleLocationCommand } from "@modules/vehicle/core/commands/update-location/update-vehicle-location";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { ISimulator } from "@shared/interfaces";

export class FleetSimulator implements ISimulator {
  private interval: NodeJS.Timeout | null = null;
  private vehicleIds: string[] = [];
  private lastHeartbeat: number = 0;
  private readonly WATCHDOG_TIMEOUT = 30000; // 30 seconds

  constructor(private readonly commandBus: ICommandBus) {}

  public initialise(ids: string[]) {
    this.vehicleIds = ids;
  }

  public heartbeat(source: string = "UNKNOWN") {
    console.log(`💓 [Simulator] Heartbeat from: ${source}`);
    this.lastHeartbeat = Date.now();
    if (!this.interval) {
      this.start();
    }
  }

  public start() {
    if (this.interval) return;

    console.log("📡 [FleetSimulator] Waking up - Active listeners detected.");

    this.tick();
    this.interval = setInterval(() => this.tick(), 5000);
  }

  public stop() {
    if (this.interval) {
      console.log("🛑 [Simulator] Stopping - no active listeners.");
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick() {
    const now = Date.now();
    const diff = now - this.lastHeartbeat;

    console.log(
      `[Watchdog] Diff: ${diff}ms | Timeout: ${this.WATCHDOG_TIMEOUT}ms`,
    );

    if (diff > this.WATCHDOG_TIMEOUT) {
      console.log("🚨 [Watchdog] TIMEOUT EXCEEDED. Shutting down...");
      this.stop();
      return;
    }

    for (const id of this.vehicleIds) {
      try {
        const latDelta = (Math.random() - 0.5) * 0.0005;
        const lngDelta = (Math.random() - 0.5) * 0.0005;

        // In a real app, you'd fetch current POS from a DB/Cache,
        // but for a demo, we can just "jitter" around a base point.
        const mockEvent = {
          vehicleId: id,
          status: Math.random() > 0.9 ? "delayed" : "active", // randomly flip status
          lat: 51.5074 + latDelta,
          lng: -0.1278 + lngDelta,
          timestamp: new Date().toISOString(),
        };

        await this.commandBus.execute(
          UpdateVehicleLocationCommand.type,
          mockEvent,
        );
      } catch (err) {
        // ideally you would log to external logger (rollbar, sentry etc.)
        console.error(`📡 [FleetSimulator] Error updating ${id}:`, err.message);
      }
    }
  }
}
