import { randomUUID } from "crypto";
import { RequestHandler } from "express";

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incomingId = req.headers["x-request-id"];

  const id =
    typeof incomingId === "string" && incomingId.length < 100
      ? incomingId
      : randomUUID();

  req.id = id;
  res.setHeader("x-request-id", id);

  next();
};
