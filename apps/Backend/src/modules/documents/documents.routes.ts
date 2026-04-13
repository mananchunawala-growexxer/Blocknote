import { Router } from "express";
import { requireAuth } from "../../middlewares/require-auth.js";
import {
  createDocumentController,
  deleteDocumentController,
  getDocumentController,
  listDocumentsController,
  renameDocumentController,
} from "./documents.controller.js";

export const documentsRouter = Router();

documentsRouter.use(requireAuth);
documentsRouter.get("/", listDocumentsController);
documentsRouter.post("/", createDocumentController);
documentsRouter.get("/:id", getDocumentController);
documentsRouter.patch("/:id", renameDocumentController);
documentsRouter.delete("/:id", deleteDocumentController);
