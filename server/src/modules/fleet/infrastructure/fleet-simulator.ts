import { UpdateVehicleLocationCommand } from "@modules/vehicle/core/commands/update-location/update-vehicle-location";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { AppError } from "@shared/errors/app.errors";
import { ISimulator } from "@shared/interfaces";
import { ILogger } from "@shared/interfaces/logger.interface";

export class FleetSimulator implements ISimulator {
  private interval: NodeJS.Timeout | null = null;
  private vehicleIds: string[] = [];
  private lastHeartbeat: number = 0;
  private readonly WATCHDOG_TIMEOUT = 30000;

  constructor(
    private readonly commandBus: ICommandBus,
    private readonly logger: ILogger,
  ) {}

  public initialise(ids: string[]) {
    this.vehicleIds = ids;
  }

  public heartbeat(source: string = "UNKNOWN") {
    this.logger.info(`[Simulator] Heartbeat from: ${source}`);
    this.lastHeartbeat = Date.now();
    if (!this.interval) {
      this.start();
    }
  }

  public start() {
    if (this.interval) return;

    this.logger.info("[FleetSimulator] Waking up - Active listeners detected.");

    this.tick();
    this.interval = setInterval(() => this.tick(), 5000);
  }

  public stop() {
    if (this.interval) {
      this.logger.info("[FleetSimulator] Stopping - no active listeners.");
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick() {
    const now = Date.now();
    const diff = now - this.lastHeartbeat;

    if (diff > this.WATCHDOG_TIMEOUT) {
      this.logger.info(
        "[FleetSimulator] WATCHDOG_TIMEOUT. Shutting down simulator...",
      );
      this.stop();
      return;
    }

    for (const id of this.vehicleIds) {
      try {
        const latDelta = (Math.random() - 0.5) * 0.0005;
        const lngDelta = (Math.random() - 0.5) * 0.0005;

        // In a real app, we'd fetch current POS from a DB/Cache,
        // but for a demo, we can just "jitter" around a base point.
        const mockEvent = {
          vehicleId: id,
          // randomly flip status for demo purposes
          status: Math.random() > 0.9 ? "delayed" : "active",
          lat: 51.5074 + latDelta,
          lng: -0.1278 + lngDelta,
          timestamp: new Date().toISOString(),
        };

        await this.commandBus.execute(
          UpdateVehicleLocationCommand.type,
          mockEvent,
        );
      } catch (err) {
        this.logger.error(
          `[FleetSimulator] Failed to update vehicle ${id}`,
          err,
        );

        if (err instanceof AppError && !err.isOperational) {
          this.stop();
        }
      }
    }
  }
}
