import { IVehicleReadRepository } from "../../interfaces";
import { ListAllVehiclesHandler, ListAllVehiclesQuery } from "../list-all-vehicles.query";

describe("ListAllVehiclesHandler", () => {
  const setup = () => {
    const mockSnapshots = [
      { id: "vehicle-1", plateNumber: "AB12 CDE" },
      { id: "vehicle-2", plateNumber: "XY98 ZZZ" },
    ];

    const repo = {
      listAll: vi.fn().mockResolvedValue(mockSnapshots),
    } as unknown as IVehicleReadRepository;

    const handler = new ListAllVehiclesHandler(repo);

    return { repo, handler, mockSnapshots };
  };

  it("delegates to the read repository and returns an enveloped response", async () => {
    const { repo, handler, mockSnapshots } = setup();

    const result = await handler.handle(new ListAllVehiclesQuery());

    expect(result.data).toEqual(mockSnapshots);
    expect(result.count).toBe(2);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    expect(repo.listAll).toHaveBeenCalled();
  });

  it("returns an empty envelope when the repository has no vehicles", async () => {
    const { repo, handler } = setup();
    vi.mocked(repo.listAll).mockResolvedValueOnce([]);

    const result = await handler.handle(new ListAllVehiclesQuery());

    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });
});
