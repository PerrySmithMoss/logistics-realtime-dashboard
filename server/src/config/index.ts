import { IAppConfig } from "@shared/interfaces/config.interface";
import { EnvValidator } from "./env";

const env = EnvValidator.validate();

export const config: IAppConfig = {
  server: {
    port: env.PORT,
    host: env.HOST,
    env: env.NODE_ENV,
    isProd: env.NODE_ENV === "production",
    isDev: env.NODE_ENV === "development",
  },
} as const;
