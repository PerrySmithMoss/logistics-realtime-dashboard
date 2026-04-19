import { NotFoundError } from "@shared/errors/app.errors";
import { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  const path = req.originalUrl || req.url;

  next(new NotFoundError(`${req.method} ${path}`));
};
