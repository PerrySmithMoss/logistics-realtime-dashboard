import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSecret } from "../secret.utils";

vi.mock("fs");

describe("secret utils", () => {
  describe("getSecret Utility", () => {
    const ENV_KEY = "OPEN_ROUTE_SERVICE_API_KEY";
    const SECRET_NAME = "fleet_open_route_service_api_key";
    const TEST_VALUE = "super-secret-value";
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetAllMocks();
      process.env = { ...originalEnv };
      delete process.env[ENV_KEY];
      delete process.env[SECRET_NAME];
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return value from process.env using the envKey", () => {
      process.env[ENV_KEY] = TEST_VALUE;

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(result).toBe(TEST_VALUE);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("should prioritize process.env even if a secret file exists", () => {
      process.env[ENV_KEY] = "env-priority";
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("file-value");

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(result).toBe("env-priority");
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("should resolve process.env file paths and return their file contents", () => {
      process.env[ENV_KEY] = `/run/secrets/${SECRET_NAME}`;
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(TEST_VALUE);

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(fs.existsSync).toHaveBeenCalledWith(`/run/secrets/${SECRET_NAME}`);
      expect(fs.readFileSync).toHaveBeenCalledWith(`/run/secrets/${SECRET_NAME}`, "utf8");
      expect(result).toBe(TEST_VALUE);
    });

    it("should treat non-/run/secrets leading slash values as literal secrets", () => {
      process.env[ENV_KEY] = "/literal-secret-value";

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(result).toBe("/literal-secret-value");
      expect(fs.existsSync).not.toHaveBeenCalled();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("should fallback to Docker secret using secretName if envKey is missing", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(TEST_VALUE);

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(fs.existsSync).toHaveBeenCalledWith(`/run/secrets/${SECRET_NAME}`);
      expect(result).toBe(TEST_VALUE);
    });

    it("should use envKey as the secret filename if secretName argument is omitted", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(TEST_VALUE);

      const result = getSecret(ENV_KEY); // Only one arg

      expect(fs.existsSync).toHaveBeenCalledWith(`/run/secrets/${ENV_KEY}`);
      expect(result).toBe(TEST_VALUE);
    });

    it("should trim whitespace and newlines from the secret file content", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("  secret-with-spaces\n ");

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(result).toBe("secret-with-spaces");
    });

    it("should return undefined if neither envKey nor secret file exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(result).toBeUndefined();
    });

    it("should return undefined and catch error if file read fails (e.g., permissions)", () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const result = getSecret(ENV_KEY, SECRET_NAME);

      expect(result).toBeUndefined();
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalled();
    });
  });
});
