import { Router } from "express";
import { requireAuth } from "../../middlewares/require-auth.js";
import {
  createDocumentController,
  deleteDocumentController,
  getDocumentController,
  getSharedDocumentController,
  listDocumentsController,
  renameDocumentController,
  updateDocumentShareController,
} from "./documents.controller.js";

export const documentsRouter = Router();

documentsRouter.get("/shared/:shareToken", getSharedDocumentController);
documentsRouter.use(requireAuth);
documentsRouter.get("/", listDocumentsController);
documentsRouter.post("/", createDocumentController);
documentsRouter.get("/:id", getDocumentController);
documentsRouter.patch("/:id", renameDocumentController);
documentsRouter.patch("/:id/share", updateDocumentShareController);
documentsRouter.post("/:id/share", updateDocumentShareController);
documentsRouter.put("/:id/share", updateDocumentShareController);
documentsRouter.delete("/:id", deleteDocumentController);
