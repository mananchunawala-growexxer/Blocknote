import crypto from "node:crypto";
import pinoHttp from "pino-http";
import { logger } from "../lib/logger.js";

export const requestLogger = pinoHttp({
  logger,
  genReqId(req) {
    return req.headers["x-request-id"]?.toString() ?? crypto.randomUUID();
  },
});
