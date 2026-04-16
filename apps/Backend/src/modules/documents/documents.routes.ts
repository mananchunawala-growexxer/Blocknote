import { Router } from "express";
import { requireAuth } from "../../middlewares/require-auth.js";
import { ERROR_CODES } from "@blocknote/shared";
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

documentsRouter.route("/shared/:shareToken")
  .get(getSharedDocumentController)
  .all((_req, res) => {
    res.status(405).json({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Shared document routes are read-only. Use GET for share tokens.",
    });
  });
documentsRouter.use(requireAuth);
documentsRouter.get("/", listDocumentsController);
documentsRouter.post("/", createDocumentController);
documentsRouter.get("/:id", getDocumentController);
documentsRouter.patch("/:id", renameDocumentController);
documentsRouter.patch("/:id/share", updateDocumentShareController);
documentsRouter.post("/:id/share", updateDocumentShareController);
documentsRouter.put("/:id/share", updateDocumentShareController);
documentsRouter.delete("/:id", deleteDocumentController);
