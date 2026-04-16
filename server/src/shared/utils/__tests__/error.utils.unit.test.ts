import { AppErrorCodes } from "@shared/errors/app.errors";
import { describe, expect, it } from "vitest";
import { getErrorData } from "../error.utils";

describe("Error utilities", () => {
  describe("getErrorData", () => {
    it("should parse a valid JSON error response", async () => {
      const mockResponseBody = {
        message: "Resource not found",
        code: AppErrorCodes.NotFound,
        details: [{ code: "ID_INVALID", message: "ID is wrong", path: "id" }],
      };

      const response = new Response(JSON.stringify(mockResponseBody), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });

      const result = await getErrorData(response);

      expect(result).toEqual({
        message: "Resource not found",
        code: AppErrorCodes.NotFound,
        details: mockResponseBody.details,
      });
    });

    it("should provide fallback values for JSON responses missing message or code", async () => {
      const response = new Response(JSON.stringify({ someOtherField: "oops" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

      const result = await getErrorData(response);

      expect(result.message).toBe("Unknown JSON Error");
      expect(result.code).toBe(AppErrorCodes.InternalServerError);
    });

    it("should handle HTML error pages (e.g., from Traefik/Nginx)", async () => {
      const htmlBody = "<html><body><h1>502 Bad Gateway</h1></body></html>";
      const response = new Response(htmlBody, {
        status: 502,
        headers: { "Content-Type": "text/html" },
      });

      const result = await getErrorData(response);

      expect(result.code).toBe(AppErrorCodes.ExternalServiceError);
      expect(result.message).toContain("502 Bad Gateway");
      expect(result.details).toHaveLength(1);
      expect(result.details?.[0]).toMatchObject({
        code: "RAW_RESPONSE",
        value: htmlBody,
      });
    });

    it("should truncate extremely long text responses to avoid log bloating", async () => {
      const longBody = "A".repeat(500);
      const response = new Response(longBody, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });

      const result = await getErrorData(response);

      expect(result.message?.length).toBe(200);
      expect(result.details?.[0].value).toBe(longBody);
    });

    it("should handle empty response bodies gracefully", async () => {
      const response = new Response(null, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });

      const result = await getErrorData(response);

      expect(result.message).toBe("Empty response body");
    });

    it("should handle cases where content-type header is missing", async () => {
      const response = new Response("Just some text", {
        status: 500,
      });

      const result = await getErrorData(response);

      expect(result.message).toBe("Just some text");
      expect(result.code).toBe(AppErrorCodes.ExternalServiceError);
    });
  });
});
