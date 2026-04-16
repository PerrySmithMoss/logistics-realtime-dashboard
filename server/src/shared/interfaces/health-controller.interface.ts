import { ApiResponse } from "@shared/types";
import { Request, Response } from "express";

export interface IHealthController {
  live(
    req: Request,
    res: Response,
  ): Response<
    ApiResponse<{
      status: string;
    }>,
    Record<string, unknown>
  >;
  ready(
    req: Request,
    res: Response,
  ): Promise<
    Response<
      ApiResponse<{
        status: string;
        uptime: number;
        timestamp: string;
      }>,
      Record<string, unknown>
    >
  >;
}
