import { ErrorCode } from "@fleet/common/errors";
import { type ApiResponseError } from "@fleet/common/types";

export const getErrorData = async (res: Response): Promise<Partial<ApiResponseError>> => {
  const rawBody = await res.text().catch(() => "");
  const contentType = res.headers.get("content-type") || "";

  if (!rawBody || !rawBody.trim()) {
    return {
      message: "Empty response body",
      code: ErrorCode.ExternalServiceError,
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
          code: data.code || ErrorCode.InternalServerError,
          details: data.details,
        };
      }
    }

    return {
      message: rawBody.slice(0, 200).trim() || `Error ${res.status}`,
      code: ErrorCode.ExternalServiceError,
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
      code: ErrorCode.InternalServerError,
    };
  }
};
