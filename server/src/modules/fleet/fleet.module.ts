import { IAppConfig } from "@config/index";
import { VehicleEvents } from "@modules/vehicle/core/events/vehicle.events";
import { mockVehicles } from "@modules/vehicle/data/mock-vehicles";
import { ICommandBus } from "@shared/interfaces/command-bus.interface";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { IGeoSnappingService } from "@shared/interfaces/geo-snapping-service.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { IQueryBus } from "@shared/interfaces/query-bus.interface";
import { FleetController } from "./api/fleet.controller";
import { IFleetController } from "./api/interfaces/fleet-controller.interface";
import { FleetEventReactor } from "./core/events/fleet-event-reactor";
import { IFleetDataService } from "./core/interfaces/fleet-data-service.interface";
import { FleetStatsProjection } from "./core/projections/fleet-stats.projection";
import { FleetDataService } from "./core/services/fleet-data.service";
import { FleetObserverService } from "./core/services/fleet-observer.service";
import { FleetEventSubscriber } from "./infrastructure/fleet-event-subscriber";
import { FleetSimulator } from "./infrastructure/fleet-simulator";

export interface FleetModuleResult {
  controller: IFleetController;
  dataService: IFleetDataService;
  simulator?: FleetSimulator;
}

export class FleetModule {
  public static async init(
    config: IAppConfig,
    lifecycle: ILifecycleManager,
    commandBus: ICommandBus,
    queryBus: IQueryBus,
    eventBroker: IEventBroker,
    logger: ILogger,
    snappingService: IGeoSnappingService,
  ): Promise<FleetModuleResult> {
    const {
      batchIntervalMs,
      hydrationTimeout,
      enableFleetSimulator,
      simulatorTickInterval,
      watchdogTimeout,
    } = config.modules.fleet;

    const projection = new FleetStatsProjection();

    const dataService = new FleetDataService(
      queryBus,
      projection,
      snappingService,
      logger,
      lifecycle,
      {
        batchIntervalMs: batchIntervalMs,
        hydrationTimeout: hydrationTimeout,
      },
    );

    const observerService = new FleetObserverService(eventBroker, logger);
    const reactor = new FleetEventReactor(dataService, eventBroker, logger);
    const subscriber = new FleetEventSubscriber(
      eventBroker,
      [
        {
          event: VehicleEvents.LOCATION_UPDATED,
          handler: (data) => reactor.onVehicleLocationChange(data),
        },
      ],
      logger,
    );

    subscriber.subscribe();

    let simulator: FleetSimulator | undefined;

    if (enableFleetSimulator) {
      simulator = new FleetSimulator(commandBus, logger, lifecycle, {
        tickInterval: simulatorTickInterval,
        watchdogTimeout: watchdogTimeout,
      });
      simulator.initialise(mockVehicles.map((v) => v.id));

      observerService.setLiveComponents(reactor, simulator);
    } else {
      observerService.setLiveComponents(reactor);
    }

    lifecycle.onShutdown(async () => {
      subscriber.unsubscribe();
      reactor.stop();
    });

    return {
      controller: new FleetController(
        config,
        observerService,
        dataService,
        lifecycle,
        config.modules.fleet.sse.heartbeatIntervalMs,
      ),
      dataService,
      simulator,
    };
  }
}
