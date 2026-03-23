interface EnvContract {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  HOST: string;
}

export class EnvValidator {
  private static errors: string[] = [];

  public static validate(): EnvContract {
    const nodeEnv = this.getEnum(
      "NODE_ENV",
      ["development", "test", "production"],
      "development",
    );
    const port = this.getNumber("PORT", 5500);
    const host = this.getString("HOST", "localhost");

    if (this.errors.length > 0) {
      throw new Error(
        `❌ Invalid Environment Configuration:\n  - ${this.errors.join("\n  - ")}`,
      );
    }

    return {
      NODE_ENV: nodeEnv as EnvContract["NODE_ENV"],
      PORT: port,
      HOST: host,
    };
  }

  private static getString(key: string, defaultValue: string): string {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value;
  }

  private static getEnum(
    key: string,
    allowed: string[],
    defaultValue: string,
  ): string {
    const value = process.env[key] || defaultValue;
    if (!allowed.includes(value)) {
      this.errors.push(
        `${key} must be one of: ${allowed.join(", ")}. Got: "${value}"`,
      );
    }
    return value;
  }

  private static getNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      this.errors.push(`${key} must be a valid number. Got: "${value}"`);
      return defaultValue;
    }
    return parsed;
  }
}
