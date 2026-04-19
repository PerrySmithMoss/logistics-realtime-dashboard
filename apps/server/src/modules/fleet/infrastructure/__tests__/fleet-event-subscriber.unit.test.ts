import { IEventBroker } from "@shared/interfaces/event-broker.interface";
import { createMockLogger, createVehicleLocationEvent } from "@shared/testing/test-utils";
import { EventSubscription, FleetEventSubscriber } from "../fleet-event-subscriber";

describe("FleetEventSubscriber", () => {
  const setup = () => {
    const broker: IEventBroker = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
    };

    const logger = createMockLogger();

    const subscriptions: EventSubscription[] = [
      {
        event: "VEHICLE.LOCATION_UPDATED",
        handler: vi.fn().mockResolvedValue(undefined),
      },
      {
        event: "FLEET.STATS_UPDATED",
        handler: vi.fn().mockResolvedValue(undefined),
      },
    ];

    const subscriber = new FleetEventSubscriber(broker, subscriptions, logger);

    return { broker, logger, subscriptions, subscriber };
  };

  it("subscribes each handler and forwards events", async () => {
    const { subscriber, broker, subscriptions } = setup();

    subscriber.subscribe();

    expect(broker.subscribe).toHaveBeenCalledTimes(2);

    const safeHandler = vi.mocked(broker.subscribe).mock.calls[0][1];

    const testEvent = createVehicleLocationEvent();

    await safeHandler(testEvent);

    expect(subscriptions[0].handler).toHaveBeenCalledWith(testEvent);
  });

  it("is idempotent - multiple subscribe calls don't double-register", () => {
    const { subscriber, broker } = setup();

    subscriber.subscribe();
    subscriber.subscribe();

    expect(broker.subscribe).toHaveBeenCalledTimes(2); // Still 2, not 4
  });

  it("logs failures without throwing", async () => {
    const { subscriber, broker, logger, subscriptions } = setup();
    subscriber.subscribe();

    const error = new Error("Handler Failed");
    vi.mocked(subscriptions[0].handler).mockRejectedValueOnce(error);

    const safeHandler = vi.mocked(broker.subscribe).mock.calls[0][1];

    await expect(safeHandler(createVehicleLocationEvent())).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("VEHICLE.LOCATION_UPDATED"),
      error,
    );
  });

  it("unsubscribes exactly what it subscribed", () => {
    const { subscriber, broker } = setup();

    subscriber.subscribe();
    subscriber.unsubscribe();

    expect(broker.unsubscribe).toHaveBeenCalledTimes(2);

    subscriber.unsubscribe();
    expect(broker.unsubscribe).toHaveBeenCalledTimes(2);
  });
});
