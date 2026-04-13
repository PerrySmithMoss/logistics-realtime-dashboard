import { randomUUID } from "crypto";
import { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const header = req.headers["x-request-id"];

  const incomingId = Array.isArray(header) ? header[0] : header;
  const sanitizedId = incomingId?.trim();

  const isValid = sanitizedId && sanitizedId.length > 0 && sanitizedId.length < 100;

  const id = isValid ? sanitizedId : randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);

  next();
};
