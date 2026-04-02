"server-only";

import { serverEnv } from "@/config/server-env";
import { createHttpClient } from "@/shared/lib/http-client";
import { FleetSnapshot, FleetVehicle } from "../types";

const http = createHttpClient({
  baseUrl: serverEnv.FLEET_API_BASE_URL,
  // TODO: Add this
  // baseUrl: serverEnv.FLEET_INTERNAL_API_KEY,
  timeout: 8000,
  retries: 2,
});

export const fleetRepository = {
  getSnapshot: (): Promise<FleetSnapshot> =>
    http.get<FleetSnapshot>("/api/v1/fleet/snapshot", { cache: "no-store" }),

  getVehicleById: (id: string): Promise<FleetVehicle> =>
    http.get<FleetVehicle>(`/api/v1/fleet/vehicles/${id}`),
};
