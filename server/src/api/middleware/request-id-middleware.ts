import { randomUUID } from "crypto";
import { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const header = req.headers["x-request-id"];

  const incomingId = Array.isArray(header) ? header[0] : header;
  const sanitisedId = incomingId?.trim();

  const isValid = sanitisedId && sanitisedId.length > 0 && sanitisedId.length < 100;

  const id = isValid ? sanitisedId : randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);

  next();
};
