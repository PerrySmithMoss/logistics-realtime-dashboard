import { UnauthorisedError } from "@shared/errors/app.errors";
import { ICache } from "@shared/interfaces/cache.interface";
import { ILogger } from "@shared/interfaces/logger.interface";
import { jwtVerify, errors as joseErrors } from "jose";

const STREAM_TOKEN_AUDIENCE = "fleet-stream";
const REPLAY_KEY_PREFIX = "stream-token:jti";

export class StreamTokenService {
  private readonly secret: Uint8Array;

  constructor(
    signingSecret: string,
    private readonly cache: ICache,
    private readonly logger: ILogger,
    private readonly options: {
      replayTtlMs?: number;
      clockToleranceSeconds?: number;
    } = {},
  ) {
    this.secret = new TextEncoder().encode(signingSecret);
  }

  public async verify(token: string, metadata: { ip?: string } = {}): Promise<void> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        audience: STREAM_TOKEN_AUDIENCE,
        algorithms: ["HS256"],
        clockTolerance: this.options.clockToleranceSeconds ?? 5,
      });

      if (typeof payload.jti !== "string" || payload.jti.length === 0) {
        this.logger.warn("[StreamTokenService] Rejected token with missing jti", metadata);
        throw new UnauthorisedError();
      }

      const replayKey = `${REPLAY_KEY_PREFIX}:${payload.jti}`;
      const isReplay = await this.cache.get<boolean>(replayKey);

      if (isReplay) {
        this.logger.warn("[StreamTokenService] Rejected replayed stream token", {
          ...metadata,
          jti: payload.jti,
        });
        throw new UnauthorisedError();
      }

      await this.cache.set(replayKey, true, this.options.replayTtlMs ?? 60_000);
    } catch (error) {
      if (error instanceof UnauthorisedError) {
        throw error;
      }

      const reason = this.getFailureReason(error);
      this.logger.warn("[StreamTokenService] Stream token verification failed", {
        ...metadata,
        reason,
      });
      throw new UnauthorisedError();
    }
  }

  private getFailureReason(error: unknown): string {
    if (error instanceof joseErrors.JWTExpired) return "expired";
    if (error instanceof joseErrors.JWTInvalid) return "invalid";
    if (error instanceof joseErrors.JWSSignatureVerificationFailed) return "bad-signature";
    if (error instanceof joseErrors.JOSEError) return error.code;
    if (error instanceof Error) return error.message;
    return "unknown";
  }
}
