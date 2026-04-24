import { Application } from "@app/application";
import { IAppConfig, createConfig } from "@config/index";
import { IFleetSnapshot } from "@modules/fleet/core/dtos/fleet-snapshot.dto";
import { IGeoSnappingService } from "@shared/interfaces/geo-snapping-service.interface";
import { DeepPartial } from "@shared/types";
import { sleep } from "@shared/utils";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { AddressInfo } from "node:net";
import path from "node:path";
import request from "supertest";
import { vi } from "vitest";
import { StreamClient, StreamClientOptions } from "./stream-client";

const TEST_INTERNAL_SECRET = "integration-test-secret";
const TEST_STREAM_SIGNING_SECRET = "integration_stream_signing_secret_32_chars";
const E2E_ENV_PATH = path.resolve(process.cwd(), ".env.test");
const DEFAULT_E2E_SYSTEM_TIME = new Date("2026-04-13T12:00:00Z");

const ACTIVE_E2E_HARNESSES = new Set<{ close: () => Promise<void> }>();

const sleepOrAdvance = async (ms: number) => {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(ms);
    return;
  }

  await sleep(ms);
};

const parseEnvFile = (raw: string): Record<string, string> => {
  const env: Record<string, string> = {};

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
};

const loadEnvFile = (filePath: string): Record<string, string> => {
  try {
    return parseEnvFile(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
};

const identitySnappingService: IGeoSnappingService = {
  async snapBatch(points) {
    return points.map((point) => ({ ...point, success: false }));
  },
};

const createStreamToken = async (secret: string) => {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("fleet-stream")
    .setIssuedAt(now)
    .setJti(crypto.randomUUID())
    .setExpirationTime(now + 30)
    .sign(new TextEncoder().encode(secret));
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
    corsAllowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
    internalAuthSecret: TEST_INTERNAL_SECRET,
    streamSigningSecret: TEST_STREAM_SIGNING_SECRET,
  },
  modules: {
    vehicle: {
      seedMockData: true,
    },
    fleet: {
      ors: {
        apiKey: "test-key",
        timeoutMs: 15000,
        retries: 1,
        retryDelayMs: 750,
        batchMaxSize: 50,
        snapRadiusMeters: 350,
      },
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

export const createE2EConfig = (overrides: Partial<NodeJS.ProcessEnv> = {}): IAppConfig =>
  createConfig({
    ...loadEnvFile(E2E_ENV_PATH),
    ...overrides,
  });

const mergeConfig = (base: IAppConfig, overrides: DeepPartial<IAppConfig> = {}): IAppConfig => ({
  ...base,
  ...overrides,
  app: {
    ...base.app,
    ...overrides.app,
  },
  server: {
    ...base.server,
    ...overrides.server,
  },
  modules: {
    ...base.modules,
    ...overrides.modules,
    vehicle: {
      ...base.modules.vehicle,
      ...overrides.modules?.vehicle,
    },
    fleet: {
      ...base.modules.fleet,
      ...overrides.modules?.fleet,
      ors: {
        ...base.modules.fleet.ors,
        ...overrides.modules?.fleet?.ors,
      },
      sse: {
        ...base.modules.fleet.sse,
        ...overrides.modules?.fleet?.sse,
      },
    },
  },
});

export const waitForReady = async (
  requester: ReturnType<typeof request>,
  timeoutMs = 1500,
): Promise<request.Response> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await requester.get("/health/ready");
    if (response.status === 200) {
      return response;
    }

    await sleepOrAdvance(25);
  }

  throw new Error("Application did not reach ready state in time");
};

export const waitForFleetSnapshot = async (
  requester: ReturnType<typeof request>,
  predicate: (snapshot: IFleetSnapshot) => boolean,
  timeoutMs = 1500,
  authHeaders: Record<string, string> = {
    "x-internal-secret": TEST_INTERNAL_SECRET,
  },
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await requester.get("/api/v1/fleet/snapshot").set(authHeaders);

    if (response.status === 200 && predicate(response.body.data)) {
      return response.body.data as IFleetSnapshot;
    }

    await sleepOrAdvance(25);
  }

  throw new Error("Fleet snapshot did not reach the expected state in time");
};

export const openFleetStream = async (app: Application, windowMs = 2000) => {
  const server = createServer(app.getServer());

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const { port } = server.address() as AddressInfo;
  const streamToken = await createStreamToken(TEST_STREAM_SIGNING_SECRET);

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
        path: `/api/v1/fleet/stream?token=${encodeURIComponent(streamToken)}`,
        method: "GET",
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
    createStreamToken: async () => createStreamToken(TEST_STREAM_SIGNING_SECRET),
    close: async () => {
      await app.dispose();
    },
  };
};

export const forceCloseAllE2EHarnesses = async () => {
  await Promise.all(Array.from(ACTIVE_E2E_HARNESSES, (harness) => harness.close()));
};

export const bootstrapE2EApp = async (
  options: {
    envOverrides?: Partial<NodeJS.ProcessEnv>;
    configOverrides?: DeepPartial<IAppConfig>;
    geoSnappingService?: IGeoSnappingService;
  } = {},
) => {
  if (!vi.isFakeTimers()) {
    vi.useFakeTimers();
    vi.setSystemTime(DEFAULT_E2E_SYSTEM_TIME);
  }

  const config = mergeConfig(createE2EConfig(options.envOverrides), options.configOverrides);
  const app = new Application(config);
  await app.bootstrap({
    geoSnappingService: options.geoSnappingService ?? identitySnappingService,
  });

  const container = app.getContainer();
  container.cache.reset?.();

  const server = createServer(app.getServer());
  await new Promise<void>((resolve) => {
    server.listen(0, config.server.host, () => resolve());
  });

  const requester = request(server);
  await waitForReady(requester);

  const address = server.address() as AddressInfo;
  const baseUrl = `http://${config.server.host}:${address.port}`;
  const activeStreams = new Set<StreamClient>();

  const harness = {
    app,
    requester,
    server,
    baseUrl,
    config,
    authHeaders: {
      "x-internal-secret": config.server.internalAuthSecret,
    },
    createStreamToken: async () => createStreamToken(config.server.streamSigningSecret),
    useFakeTimers: (now: Date = DEFAULT_E2E_SYSTEM_TIME) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
    },
    useRealTimers: () => {
      vi.useRealTimers();
    },
    waitForFleetSnapshot: (predicate: (snapshot: IFleetSnapshot) => boolean, timeoutMs?: number) =>
      waitForFleetSnapshot(requester, predicate, timeoutMs, harness.authHeaders),
    openStream: async (streamOptions: Omit<StreamClientOptions, "baseUrl" | "headers"> = {}) => {
      const token = await harness.createStreamToken();
      const client = new StreamClient({
        baseUrl,
        path: `/api/v1/fleet/stream?token=${encodeURIComponent(token)}`,
        ...streamOptions,
      });

      activeStreams.add(client);

      try {
        await client.open();
      } catch (error) {
        activeStreams.delete(client);
        throw error;
      }

      client.onClose(() => {
        activeStreams.delete(client);
      });

      return client;
    },
    close: async () => {
      ACTIVE_E2E_HARNESSES.delete(harness);

      await Promise.all(Array.from(activeStreams, (client) => client.close(true)));
      activeStreams.clear();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      container.cache.reset?.();
      container.database.reset?.();
      await app.dispose();
    },
  };

  ACTIVE_E2E_HARNESSES.add(harness);

  return harness;
};
