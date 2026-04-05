import { IAppConfig } from "@config/index";
import { VehicleEvents } from "@modules/vehicle/core/events/vehicle.events";
import { mockVehicles } from "@modules/vehicle/data/mock-vehicles";
import { ICommandBus } from "@shared/bus/command/command-bus.interface";
import { IQueryBus } from "@shared/bus/query/query-bus.interface";
import { OpenRouteServiceClient } from "@shared/infrastructure/geo";
import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { ILifecycleManager } from "@shared/interfaces/lifecycle-manager.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
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
}

export class FleetModule {
  public static async init(
    config: IAppConfig["modules"]["fleet"],
    lifecycle: ILifecycleManager,
    commandBus: ICommandBus,
    queryBus: IQueryBus,
    eventBroker: IEventBroker,
    logger: ILogger,
  ): Promise<FleetModuleResult> {
    const projection = new FleetStatsProjection();
    const orsClient = new OpenRouteServiceClient(config.orsApiKey, logger);

    const dataService = new FleetDataService(
      queryBus,
      projection,
      orsClient,
      logger,
      lifecycle,
      {
        batchIntervalMs: config.batchIntervalMs,
        hydrationTimeout: config.hydrationTimeout,
      },
    );

    const observerService = new FleetObserverService(eventBroker, logger);

    if (config.enableFleetSimulator) {
      const simulator = new FleetSimulator(commandBus, logger, lifecycle, {
        tickInterval: config.simulatorTickInterval,
        watchdogTimeout: config.watchdogTimeout,
      });
      simulator.initialise(mockVehicles.map((v) => v.id));

      const reactor = new FleetEventReactor(dataService, eventBroker, logger);

      observerService.setLiveComponents(reactor, simulator);

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

      lifecycle.onShutdown(async () => {
        subscriber.unsubscribe();
        reactor.stop();
        simulator.stop();
      });
    }

    return {
      controller: new FleetController(observerService, dataService, lifecycle),
      dataService,
    };
  }
}
