import { describe, expect, it } from "vitest";
import { AppError, ErrorCode, ExternalServiceError } from "@/shared/errors";
import { getFriendlyErrorMessage } from "../get-friendly-error-message.util";

describe("getFriendlyErrorMessage", () => {
  it("returns a generic message for unknown errors", () => {
    expect(getFriendlyErrorMessage(new Error("boom"))).toBe("Something went wrong.");
  });

  it("maps common AppError codes to user-facing copy", () => {
    expect(getFriendlyErrorMessage(new ExternalServiceError("Fleet API"))).toBe(
      "Unable to reach an external service.",
    );
    expect(getFriendlyErrorMessage(new AppError("No access", ErrorCode.Forbidden, 403))).toBe(
      "You don't have access to this.",
    );
  });

  it("falls back to the original error message for unmapped app errors", () => {
    expect(
      getFriendlyErrorMessage(new AppError("Custom domain failure", ErrorCode.FetchError, 502)),
    ).toBe("Custom domain failure");
  });
});
