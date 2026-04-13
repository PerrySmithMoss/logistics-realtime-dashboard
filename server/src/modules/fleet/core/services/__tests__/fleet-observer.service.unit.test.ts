import {
  createMockEventBroker,
  createMockFleetReactor,
  createMockFleetSimulator,
  createMockLogger,
  createMockSseResponse,
} from "@shared/testing/test-utils";
import { FleetStatsUpdatedEvent } from "../../events/fleet-events";
import { FleetObserverService } from "../fleet-observer.service";

describe("FleetObserverService", () => {
  const setup = () => {
    const broker = createMockEventBroker();
    const logger = createMockLogger();
    const reactor = createMockFleetReactor();
    const simulator = createMockFleetSimulator();

    const service = new FleetObserverService(broker, logger);

    return { broker, logger, reactor, simulator, service };
  };

  it("rejects observer registration until live components are wired", () => {
    const { service, logger } = setup();

    expect(() => service.addObserver("obs-1", createMockSseResponse(), vi.fn())).toThrow(
      "Fleet Tracking Pipeline is not initialised.",
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("reactor and simulator are missing."),
    );
  });

  it("activates the pipeline for the first observer and deactivates it when the last observer leaves", () => {
    const { service, broker, reactor, simulator } = setup();
    service.setLiveComponents(reactor, simulator);

    service.addObserver("obs-1", createMockSseResponse(), vi.fn());

    expect(reactor.start).toHaveBeenCalledTimes(1);
    expect(broker.subscribe).toHaveBeenCalledWith(
      FleetStatsUpdatedEvent.type,
      expect.any(Function),
    );
    expect(simulator.heartbeat).toHaveBeenCalledWith("PIPELINE_START");

    service.removeObserver("obs-1");

    expect(reactor.stop).toHaveBeenCalledTimes(1);
    expect(broker.unsubscribe).toHaveBeenCalledWith(
      FleetStatsUpdatedEvent.type,
      expect.any(Function),
    );
    expect(simulator.stop).toHaveBeenCalledTimes(1);
  });

  it("heartbeats the simulator only while observers are connected", () => {
    const { service, reactor, simulator } = setup();
    service.setLiveComponents(reactor, simulator);

    service.keepAlive();
    expect(simulator.heartbeat).not.toHaveBeenCalled();

    service.addObserver("obs-1", createMockSseResponse(), vi.fn());
    service.keepAlive();

    expect(simulator.heartbeat).toHaveBeenCalledWith("OBSERVER_KEEP_ALIVE");
  });

  it("removes stale observers during broadcast and shuts the pipeline down if none remain", () => {
    const { service, broker, reactor, simulator, logger } = setup();
    service.setLiveComponents(reactor, simulator);

    const staleRes = createMockSseResponse();
    staleRes.writable = false;

    service.addObserver("obs-1", staleRes, vi.fn());

    const broadcast = vi.mocked(broker.subscribe).mock.calls[0][1] as (
      event: FleetStatsUpdatedEvent,
    ) => void;
    broadcast(
      new FleetStatsUpdatedEvent({
        summary: {
          total: 1,
          activeCount: 1,
          delayedCount: 0,
          performancePct: 100,
        },
        vehicles: [],
      }),
    );

    expect(logger.debug).toHaveBeenCalledWith(
      "[FleetObserverService] Cleaned up stale observer: obs-1",
    );
    expect(reactor.stop).toHaveBeenCalledTimes(1);
    expect(simulator.stop).toHaveBeenCalledTimes(1);
  });

  it("drops observers whose callbacks throw and logs the failure", () => {
    const { service, broker, logger, reactor, simulator } = setup();
    service.setLiveComponents(reactor, simulator);
    const callback = vi.fn(() => {
      throw new Error("socket write failed");
    });

    service.addObserver("obs-1", createMockSseResponse(), callback);

    const broadcast = vi.mocked(broker.subscribe).mock.calls[0][1] as (
      event: FleetStatsUpdatedEvent,
    ) => void;
    broadcast(
      new FleetStatsUpdatedEvent({
        summary: {
          total: 1,
          activeCount: 1,
          delayedCount: 0,
          performancePct: 100,
        },
        vehicles: [],
      }),
    );

    expect(logger.error).toHaveBeenCalledWith(
      "[FleetObserverService] Failed to send to obs-1:",
      expect.any(Error),
    );
    expect(simulator.stop).toHaveBeenCalledTimes(1);
  });

  it("handles concurrent observer additions without double-activating", () => {
    const { service, reactor, simulator } = setup();
    service.setLiveComponents(reactor, simulator);

    service.addObserver("obs-1", createMockSseResponse(), vi.fn());
    service.addObserver("obs-2", createMockSseResponse(), vi.fn());

    expect(reactor.start).toHaveBeenCalledTimes(1);
    expect(simulator.heartbeat).toHaveBeenCalledTimes(1);
  });

  it("reactivates the pipeline correctly when a new observer joins after a total shutdown", () => {
    const { service, reactor, simulator } = setup();
    service.setLiveComponents(reactor, simulator);

    service.addObserver("obs-1", createMockSseResponse(), vi.fn());
    service.removeObserver("obs-1");
    expect(reactor.stop).toHaveBeenCalledTimes(1);

    service.addObserver("obs-2", createMockSseResponse(), vi.fn());
    expect(reactor.start).toHaveBeenCalledTimes(2);
    expect(simulator.heartbeat).toHaveBeenCalledWith("PIPELINE_START");
  });

  it("continues broadcasting to remaining observers if one fails mid-loop", () => {
    const { service, broker, logger, reactor, simulator } = setup();
    service.setLiveComponents(reactor, simulator);

    const failCallback = vi.fn(() => {
      throw new Error("Fail");
    });
    const successCallback = vi.fn();

    service.addObserver("fail-me", createMockSseResponse(), failCallback);
    service.addObserver("success-me", createMockSseResponse(), successCallback);

    const mockPayload = {
      summary: {
        total: 2,
        activeCount: 1,
        delayedCount: 1,
        performancePct: 50,
      },
      vehicles: [],
    };

    const broadcast = vi.mocked(broker.subscribe).mock.calls[0][1];
    broadcast(new FleetStatsUpdatedEvent(mockPayload));

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("fail-me"),
      expect.any(Error),
    );

    expect(successCallback).toHaveBeenCalledWith(mockPayload);
    expect(successCallback).toHaveBeenCalledTimes(1);
  });

  it("immediately stops the pipeline if the last observer is found stale during broadcast", () => {
    const { service, broker, reactor, simulator } = setup();

    service.setLiveComponents(reactor, simulator);

    const staleRes = createMockSseResponse();
    staleRes.writable = false;

    service.addObserver("last-stale-man", staleRes, vi.fn());

    const mockPayload = {
      summary: {
        total: 2,
        activeCount: 1,
        delayedCount: 1,
        performancePct: 50,
      },
      vehicles: [],
    };

    const broadcast = vi.mocked(broker.subscribe).mock.calls[0][1];
    broadcast(new FleetStatsUpdatedEvent(mockPayload));

    expect(reactor.stop).toHaveBeenCalled();
    expect(simulator.stop).toHaveBeenCalled();
    expect(vi.mocked(broker.unsubscribe)).toHaveBeenCalled();
  });
});
