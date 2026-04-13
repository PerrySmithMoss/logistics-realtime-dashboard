import {
  UpdateVehicleLocationCommand,
  UpdateVehicleLocationHandler,
} from "@modules/vehicle/core/commands";
import { Vehicle } from "@modules/vehicle/core/entities";
import { IVehicleReadRepository, IVehicleWriteRepository } from "@modules/vehicle/core/interfaces";
import { BadRequestError } from "@shared/errors/app.errors";
import { IEventBroker, IVehicleStatusChangeEvent } from "@shared/interfaces";
import { VehicleStatus } from "@shared/types/vehicle.types";

describe("UpdateVehicleLocationHandler", () => {
  const setup = () => {
    const repository = {
      findById: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as IVehicleWriteRepository & IVehicleReadRepository;

    const eventBroker = {
      publish: vi.fn(),
    } as unknown as IEventBroker;

    const handler = new UpdateVehicleLocationHandler(repository, eventBroker);

    return { repository, eventBroker, handler };
  };

  const createVehicle = () =>
    Vehicle.create({
      id: "vehicle-1",
      plateNumber: "AB12 CDE",
      lat: 51.5,
      lng: -0.12,
      status: VehicleStatus.Active,
    });

  it("does not publish an event if the repository save fails", async () => {
    const { handler, repository, eventBroker } = setup();
    const vehicle = createVehicle();
    vi.mocked(repository.findById).mockResolvedValue(vehicle);
    vi.mocked(repository.save).mockRejectedValue(new Error("DB Down"));

    const command = new UpdateVehicleLocationCommand("v-1", 51, -0.1, VehicleStatus.Active);

    await expect(handler.handle(command)).rejects.toThrow("DB Down");
    expect(eventBroker.publish).not.toHaveBeenCalled();
  });

  it("propagates domain validation errors (e.g., invalid coordinates)", async () => {
    const { handler, repository, eventBroker } = setup();
    const vehicle = createVehicle();
    vi.mocked(repository.findById).mockResolvedValue(vehicle);

    const command = new UpdateVehicleLocationCommand("vehicle-1", 100, -0.13, VehicleStatus.Active);

    await expect(handler.handle(command)).rejects.toThrow(BadRequestError);
    expect(repository.save).not.toHaveBeenCalled();
    expect(eventBroker.publish).not.toHaveBeenCalled();
  });

  it("ensures the timestamp in the event is the new updated date, not the old one", async () => {
    vi.useFakeTimers();
    const { handler, repository, eventBroker } = setup();
    const vehicle = createVehicle();
    const oldDate = vehicle.toSnapshot().lastUpdated;

    vi.mocked(repository.findById).mockResolvedValue(vehicle);

    vi.advanceTimersByTime(60000);

    await handler.handle(
      new UpdateVehicleLocationCommand("v-1", 51.6, -0.13, VehicleStatus.Active),
    );

    const payload = vi.mocked(eventBroker.publish).mock.calls[0][1] as IVehicleStatusChangeEvent;
    expect(payload.timestamp).not.toBe(oldDate);

    vi.useRealTimers();
  });
});
