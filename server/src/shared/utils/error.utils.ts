import { AppErrorCodes } from "@shared/errors/app.errors";
import { ApiResponseError } from "@shared/types";

export const getErrorData = async (res: Response): Promise<Partial<ApiResponseError>> => {
  const rawBody = await res.text().catch(() => "");
  const contentType = res.headers.get("content-type") || "";

  if (!rawBody || !rawBody.trim()) {
    return {
      message: "Empty response body",
      code: AppErrorCodes.ExternalServiceError,
      details: [
        {
          code: "EMPTY_BODY",
          message: `Response returned status ${res.status} with no body`,
          path: "body",
        },
      ],
    };
  }

  try {
    if (contentType.includes("application/json")) {
      const data = JSON.parse(rawBody);

      if (data && typeof data === "object") {
        return {
          message: data.message || "Unknown JSON Error",
          code: data.code || AppErrorCodes.InternalServerError,
          details: data.details,
        };
      }
    }

    return {
      message: rawBody.slice(0, 200).trim() || `Error ${res.status}`,
      code: AppErrorCodes.ExternalServiceError,
      details: [
        {
          code: "RAW_RESPONSE",
          message: "Non-JSON or malformed response",
          path: "body",
          value: rawBody,
        },
      ],
    };
  } catch {
    return {
      message: rawBody.slice(0, 200) || "Failed to parse error response",
      code: AppErrorCodes.InternalServerError,
    };
  }
};
