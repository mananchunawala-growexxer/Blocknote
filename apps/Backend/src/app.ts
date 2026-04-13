import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json());
app.use(requestLogger);
app.use("/api", apiRouter);
app.use(errorHandler);
