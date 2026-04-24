export interface IStreamTokenService {
  verify(token: string, options: { ip: string | undefined }): Promise<void>;
}
