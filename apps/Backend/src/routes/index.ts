import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { documentsRouter } from "../modules/documents/documents.routes.js";
import { blocksRouter } from "../modules/blocks/blocks.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/documents", documentsRouter);
apiRouter.use("/blocks", blocksRouter);
