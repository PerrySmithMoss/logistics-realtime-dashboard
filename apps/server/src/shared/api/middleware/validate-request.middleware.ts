import { InternalServerError, UnprocessableEntityError } from "@shared/errors/app.errors";
import { type ApiResponseErrorDetails } from "@fleet/common/types";
import { Request, RequestHandler } from "express";
import { z } from "zod";

const validationTargets = ["body", "query", "params"] as const;

export type RequestValidationTarget = (typeof validationTargets)[number];

export type RequestValidationSchemas = Partial<Record<RequestValidationTarget, z.ZodType<unknown>>>;

type InferSchema<TSchema> = TSchema extends z.ZodType<unknown> ? z.infer<TSchema> : undefined;

export type ValidatedRequestData<TSchemas extends RequestValidationSchemas> = {
  body: InferSchema<TSchemas["body"]>;
  query: InferSchema<TSchemas["query"]>;
  params: InferSchema<TSchemas["params"]>;
};

export type ValidatedRequestStore = Partial<Record<RequestValidationTarget, unknown>>;

const toErrorDetails = (
  target: RequestValidationTarget,
  error: z.ZodError,
): ApiResponseErrorDetails[] => {
  return error.issues.map((issue) => {
    const issuePath = issue.path.length > 0 ? `${target}.${issue.path.join(".")}` : target;

    return {
      code: issue.code.toUpperCase(),
      message: issue.message,
      path: issuePath,
    };
  });
};

export const validateRequest = <TSchemas extends RequestValidationSchemas>(
  schemas: TSchemas,
): RequestHandler => {
  return (req, _res, next) => {
    const errors: ApiResponseErrorDetails[] = [];
    const validated: ValidatedRequestStore = {};

    for (const target of validationTargets) {
      const schema = schemas[target];

      if (!schema) {
        continue;
      }

      const result = schema.safeParse(req[target]);

      if (!result.success) {
        errors.push(...toErrorDetails(target, result.error));
        continue;
      }

      validated[target] = result.data;
    }

    if (errors.length > 0) {
      throw new UnprocessableEntityError("Request validation failed", errors);
    }

    req.validated = Object.freeze(validated);
    next();
  };
};

export const getValidatedRequestData = <TSchemas extends RequestValidationSchemas>(
  req: Request,
): ValidatedRequestData<TSchemas> => {
  if (!req.validated) {
    throw new InternalServerError("Validated request data was not found on the request.");
  }

  return req.validated as ValidatedRequestData<TSchemas>;
};
