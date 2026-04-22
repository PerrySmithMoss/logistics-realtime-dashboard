import fs from "node:fs";

/**
 * Loads a value from process.env OR a Docker secret file
 * @param envKey - The standard environment variable name (e.g., PORT)
 * @param secretName - Optional: The name of the Docker secret file
 */
export const getSecret = (envKey: string, secretName?: string): string | undefined => {
  const envValue = process.env[envKey];
  const isDockerSecretPath = envValue?.startsWith("/run/secrets/");

  if (envValue) {
    if (isDockerSecretPath) {
      try {
        if (fs.existsSync(envValue)) {
          return fs.readFileSync(envValue, "utf8").trim();
        }
      } catch {
        return undefined;
      }

      return undefined;
    }

    return envValue;
  }

  const fileName = secretName ?? envKey;
  const secretPath = `/run/secrets/${fileName}`;

  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, "utf8").trim();
    }
  } catch {
    return undefined;
  }

  return undefined;
};
