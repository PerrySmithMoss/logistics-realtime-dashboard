import cors from "cors";
import { RequestHandler } from "express";

export const corsMiddleware = (allowedOrigins: string[]): RequestHandler => {
  const allowed = new Set(allowedOrigins);

  return cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowed.has(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    methods: ["OPTIONS", "GET", "PATCH", "PUT", "POST"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    optionsSuccessStatus: 204,
  });
};
