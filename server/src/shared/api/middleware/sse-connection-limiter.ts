import { NextFunction, Request, Response } from "express";

// Tracks active SSE connections per IP
// In a real app you would replace this with Redis,
// so it could be distributed between all apps.
const activeConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 3;

export const sseConnectionLimiter = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const ip = req.ip ?? "unknown";
  const current = activeConnections.get(ip) ?? 0;

  if (current >= MAX_CONNECTIONS_PER_IP) {
    return res.status(429).json({
      error: "Too many concurrent stream connections from this IP",
    });
  }

  activeConnections.set(ip, current + 1);

  // Clean up when the SSE connection closes
  res.on("close", () => {
    const count = activeConnections.get(ip) ?? 1;
    if (count <= 1) {
      activeConnections.delete(ip);
    } else {
      activeConnections.set(ip, count - 1);
    }
  });

  next();
};
