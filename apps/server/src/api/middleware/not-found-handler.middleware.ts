import { NotFoundError } from "@shared/errors/app.errors";
import { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`${req.method} ${req.path}`));
};
