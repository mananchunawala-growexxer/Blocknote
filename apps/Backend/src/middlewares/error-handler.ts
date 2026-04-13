import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ERROR_CODES } from "@blocknote/shared";
import { ApiError } from "../lib/api-error.js";
import { logger } from "../lib/logger.js";

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Validation failed",
      details: { issues: error.flatten() },
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  logger.error({ err: error, requestId: req.id }, "Unhandled request error");
  res.status(500).json({
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: "Internal server error",
  });
}
