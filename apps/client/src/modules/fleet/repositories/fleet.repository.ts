"server-only";

import { serverEnv } from "@/config/server-env";
import { createHttpClient } from "@/shared/lib/http-client";
import { FleetSnapshot, FleetVehicle } from "../types";

const http = createHttpClient({
  baseUrl: serverEnv.FLEET_API_BASE_URL,
  timeout: 8000,
  retries: 2,
  defaultHeaders: {
    "X-Internal-Secret": serverEnv.FLEET_API_INTERNAL_KEY,
  },
});

export const fleetRepository = {
  getSnapshot: (): Promise<FleetSnapshot> =>
    http.get<FleetSnapshot>("/api/v1/fleet/snapshot", {
      cache: "no-store",
      label: "Fleet_Snapshot",
      transform: true,
    }),

  getVehicleById: (id: string): Promise<FleetVehicle> =>
    http.get<FleetVehicle>(`/api/v1/fleet/vehicles/${id}`, {
      label: "Fleet_VehicleById",
      transform: true,
    }),
};
