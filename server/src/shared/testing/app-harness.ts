import { Application } from "@app/application";
import { IAppConfig } from "@config/index";
import { IFleetSnapshot } from "@modules/fleet/core/dtos/fleet-snapshot.dto";
import { IGeoSnappingService } from "@shared/interfaces/geo-snapping-service.interface";
import { createServer, request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";
import request from "supertest";

export const TEST_INTERNAL_SECRET = "integration-test-secret";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const identitySnappingService: IGeoSnappingService = {
  async snapBatch(points) {
    return points.map((point) => ({ ...point, success: false }));
  },
};

export const createIntegrationConfig = (): IAppConfig => ({
  app: {
    version: "test",
    name: "server",
  },
  server: {
    port: 0,
    host: "127.0.0.1",
    env: "test",
    isProd: false,
    isDev: false,
    isTest: true,
    minLogLevel: "ERROR",
    internalAuthSecret: TEST_INTERNAL_SECRET,
  },
  modules: {
    vehicle: {
      seedMockData: true,
    },
    fleet: {
      orsApiKey: "test-key",
      enableFleetSimulator: true,
      simulatorTickInterval: 100,
      watchdogTimeout: 1000,
      batchIntervalMs: 25,
      hydrationTimeout: 1000,
      sse: {
        maxConcurrent: 3,
        minRetryMs: 100,
        heartbeatIntervalMs: 250,
      },
    },
  },
});

export const waitForReady = async (requester: ReturnType<typeof request>, timeoutMs = 1500) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await requester.get("/health/ready");
    if (response.status === 200) {
      return response;
    }

    await sleep(25);
  }

  throw new Error("Application did not reach ready state in time");
};

export const waitForFleetSnapshot = async (
  requester: ReturnType<typeof request>,
  predicate: (snapshot: IFleetSnapshot) => boolean,
  timeoutMs = 1500,
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await requester
      .get("/api/v1/fleet/snapshot")
      .set("x-internal-secret", TEST_INTERNAL_SECRET);

    if (response.status === 200 && predicate(response.body.data)) {
      return response.body.data as IFleetSnapshot;
    }

    await sleep(25);
  }

  throw new Error("Fleet snapshot did not reach the expected state in time");
};

export const openFleetStream = async (app: Application, windowMs = 2000) => {
  const server = createServer(app.getServer());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server.address() as AddressInfo;

  return new Promise<{
    statusCode?: number;
    headers: Record<string, string | string[] | undefined>;
    events: Array<{ event: string; data: unknown }>;
    heartbeats: number;
  }>((resolve, reject) => {
    const events: Array<{ event: string; data: unknown }> = [];
    let heartbeats = 0;
    let buffer = "";
    let finished = false;

    const req = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: "/api/v1/fleet/stream",
        method: "GET",
        headers: {
          "x-internal-secret": TEST_INTERNAL_SECRET,
        },
      },
      (res) => {
        const finalize = () => {
          if (finished) return;
          finished = true;
          req.destroy();
          res.destroy();
          server.close(() =>
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              events,
              heartbeats,
            }),
          );
        };

        const timer = setTimeout(finalize, windowMs);

        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          buffer += chunk;

          let heartbeatIndex = buffer.indexOf(":\n\n");
          while (heartbeatIndex !== -1) {
            heartbeats++;
            buffer = buffer.slice(heartbeatIndex + 3);
            heartbeatIndex = buffer.indexOf(":\n\n");
          }

          let eventBoundary = buffer.indexOf("\n\n");
          while (eventBoundary !== -1) {
            const frame = buffer.slice(0, eventBoundary);
            buffer = buffer.slice(eventBoundary + 2);

            const eventMatch = frame.match(/^event:\s*(.+)$/m);
            const dataMatch = frame.match(/^data:\s*(.+)$/m);

            if (eventMatch && dataMatch) {
              events.push({
                event: eventMatch[1],
                data: JSON.parse(dataMatch[1]),
              });
            }

            eventBoundary = buffer.indexOf("\n\n");
          }
        });

        res.on("error", (error) => {
          if (finished && error.message === "aborted") {
            return;
          }
          clearTimeout(timer);
          server.close(() => reject(error));
        });
      },
    );

    req.on("error", (error) => {
      if (finished && error.message === "socket hang up") {
        return;
      }
      server.close(() => reject(error));
    });

    req.end();
  });
};

export const bootstrapIntegrationApp = async () => {
  const app = new Application(createIntegrationConfig());
  await app.bootstrap({ geoSnappingService: identitySnappingService });

  const requester = request(app.getServer());
  await waitForReady(requester);

  return {
    app,
    requester,
    authHeaders: {
      "x-internal-secret": TEST_INTERNAL_SECRET,
    },
    close: async () => {
      await app.dispose();
    },
  };
};
