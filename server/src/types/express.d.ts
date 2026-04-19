import { ValidatedRequestStore } from "@shared/api/middleware/validate-request.middleware";

export {};

declare global {
  namespace Express {
    interface Request {
      id: string;
      validated?: ValidatedRequestStore;
    }
  }
}
