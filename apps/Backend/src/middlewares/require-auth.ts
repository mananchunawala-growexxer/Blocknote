import type { NextFunction, Request, Response } from "express";
import { ERROR_CODES } from "@blocknote/shared";
import { ApiError } from "../lib/api-error.js";
import { verifyAccessToken } from "../lib/jwt.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new ApiError(401, ERROR_CODES.AUTH_UNAUTHORIZED, "Missing access token"));
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      id: payload.sub,
      email: payload.email,
    };
    next();
  } catch {
    next(new ApiError(401, ERROR_CODES.AUTH_UNAUTHORIZED, "Invalid or expired access token"));
  }
}
