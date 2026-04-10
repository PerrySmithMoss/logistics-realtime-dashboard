import { UpdateVehicleLocationCommand } from "@modules/vehicle/core/commands/update-location/update-vehicle-location";
import { AppError } from "@shared/errors/app.errors";
import { ILifecycleManager, ISimulator } from "@shared/interfaces";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { ILogger } from "@shared/interfaces/logger.interface";

export class FleetSimulator implements ISimulator {
  private interval: NodeJS.Timeout | null = null;
  private vehicleIds: string[] = [];
  private lastHeartbeat: number = 0;
  private vehicleStates = new Map<
    string,
    { lat: number; lng: number; heading: number }
  >();

  constructor(
    private readonly commandBus: ICommandBus,
    private readonly logger: ILogger,
    private readonly lifecycle: ILifecycleManager,
    private readonly settings: {
      tickInterval: number;
      watchdogTimeout: number;
    },
  ) {
    this.lifecycle.onShutdown(async () => {
      this.stop();
    });
  }

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
    if (this.interval || this.lifecycle.isShuttingDown) return;

    this.logger.info("[FleetSimulator] Waking up - Active listeners detected.");

    this.tick();
    this.interval = setInterval(() => this.tick(), this.settings.tickInterval);
  }

  public stop() {
    if (this.interval) {
      this.logger.info("[FleetSimulator] Stopping - no active listeners.");
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick() {
    if (this.lifecycle.isShuttingDown) {
      this.stop();
      return;
    }

    const now = Date.now();
    const diff = now - this.lastHeartbeat;

    if (diff > this.settings.watchdogTimeout) {
      this.logger.info(
        "[FleetSimulator] WATCHDOG_TIMEOUT. Shutting down simulator...",
      );
      this.stop();
      return;
    }

    const signal = this.lifecycle.getShutdownSignal();

    for (const id of this.vehicleIds) {
      if (signal.aborted) break;

      try {
        let state = this.vehicleStates.get(id);
        if (!state) {
          state = {
            lat: 51.5074 + (Math.random() - 0.5) * 0.01,
            lng: -0.1278 + (Math.random() - 0.5) * 0.01,
            heading: Math.random() * 2 * Math.PI,
          };
        }

        const speed = 0.0002;
        const steeringDrift = (Math.random() - 0.5) * 0.2;

        state.heading += steeringDrift;
        state.lat += Math.cos(state.heading) * speed;
        state.lng += Math.sin(state.heading) * speed;

        this.vehicleStates.set(id, state);

        // change status for demo purposes
        const status = Math.random() > 0.98 ? "delayed" : "active";

        await this.commandBus.execute(
          UpdateVehicleLocationCommand.type,
          new UpdateVehicleLocationCommand(id, state.lat, state.lng, status),
          { signal },
        );
      } catch (err) {
        if (signal.aborted) return;

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
