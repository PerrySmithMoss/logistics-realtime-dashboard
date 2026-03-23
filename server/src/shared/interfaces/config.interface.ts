export interface IServerConfig {
  readonly port: number;
  readonly env: string;
  readonly host: string;
  readonly isProd: boolean;
  readonly isDev: boolean;
}

export interface IAppConfig {
  readonly server: IServerConfig;
}
