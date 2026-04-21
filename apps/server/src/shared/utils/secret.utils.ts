import fs from "fs";

/**
 * Loads a value from process.env or a Docker Swarm secret file
 */
export const getSecret = (key: string): string | undefined => {
  if (process.env[key]) {
    return process.env[key];
  }

  const secretPath = `/run/secrets/${key}`;
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, "utf8").trim();
    }
  } catch {
    return undefined;
  }

  return undefined;
};
