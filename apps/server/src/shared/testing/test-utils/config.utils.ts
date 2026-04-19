import { IAppConfig } from "@config/index";
import { DeepPartial } from "@shared/types";

export const createMockConfig = (overrides: DeepPartial<IAppConfig> = {}): IAppConfig => {
  const baseConfig: IAppConfig = {
    app: {
      version: "1.0.0",
      name: "test-app",
    },
    server: {
      port: 5500,
      host: "localhost",
      env: "test",
      isProd: false,
      isDev: true,
      isTest: true,
      minLogLevel: "DEBUG",
      internalAuthSecret: "test-secret-at-least-32-chars-long-for-validity",
    },
    modules: {
      vehicle: {
        seedMockData: false,
      },
      fleet: {
        orsApiKey: "test-api-key",
        enableFleetSimulator: false,
        simulatorTickInterval: 2000,
        watchdogTimeout: 30000,
        batchIntervalMs: 1000,
        hydrationTimeout: 30000,
        sse: {
          maxConcurrent: 3,
          minRetryMs: 2000,
          heartbeatIntervalMs: 15000,
        },
      },
    },
  };

  return {
    ...baseConfig,
    ...overrides,
    app: { ...baseConfig.app, ...overrides.app },
    server: { ...baseConfig.server, ...overrides.server },
    modules: {
      ...baseConfig.modules,
      vehicle: { ...baseConfig.modules.vehicle, ...overrides.modules?.vehicle },
      fleet: {
        ...baseConfig.modules.fleet,
        ...overrides.modules?.fleet,
        sse: {
          ...baseConfig.modules.fleet.sse,
          ...overrides.modules?.fleet?.sse,
        },
      },
    },
  };
};
