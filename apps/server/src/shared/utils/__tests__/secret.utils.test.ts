import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSecret } from "../secret.utils";

vi.mock("fs");

describe("secret utils", () => {
  describe("getSecret Utility", () => {
    const TEST_KEY = "MY_SECRET_KEY";
    const TEST_VALUE = "super-secret-value";
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetAllMocks();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should return value from process.env if it exists", () => {
      process.env[TEST_KEY] = TEST_VALUE;

      const result = getSecret(TEST_KEY);

      expect(result).toBe(TEST_VALUE);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("should return value from Docker secret file if process.env is missing", () => {
      delete process.env[TEST_KEY];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(TEST_VALUE);

      const result = getSecret(TEST_KEY);

      expect(fs.existsSync).toHaveBeenCalledWith(`/run/secrets/${TEST_KEY}`);
      expect(result).toBe(TEST_VALUE);
    });

    it("should trim whitespace/newlines from the secret file content", () => {
      delete process.env[TEST_KEY];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("  secret-with-spaces\n ");

      const result = getSecret(TEST_KEY);

      expect(result).toBe("secret-with-spaces");
    });

    it("should return undefined if key exists neither in env nor secrets", () => {
      delete process.env[TEST_KEY];
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = getSecret(TEST_KEY);

      expect(result).toBeUndefined();
    });

    it("should return undefined if filesystem throws an error (e.g. Permission Denied)", () => {
      delete process.env[TEST_KEY];
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const result = getSecret(TEST_KEY);

      expect(result).toBeUndefined();
      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalled();
    });

    it("should prioritize process.env over Docker secret file", () => {
      process.env[TEST_KEY] = "env-value";
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("file-value");

      const result = getSecret(TEST_KEY);

      expect(result).toBe("env-value");
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });
  });
});
