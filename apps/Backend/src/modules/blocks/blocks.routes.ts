import { Router } from "express";
import { requireAuth } from "../../middlewares/require-auth.js";
import {
  createBlockController,
  deleteBlockController,
  listBlocksController,
  reorderBlockController,
  updateBlockController,
} from "./blocks.controller.js";

export const blocksRouter = Router();

// All block routes require authentication
blocksRouter.use(requireAuth);

// List blocks for a document
blocksRouter.get("/documents/:documentId/blocks", listBlocksController);

// Create a new block
blocksRouter.post("/", createBlockController);

// Update a block
blocksRouter.patch("/:blockId", updateBlockController);

// Reorder a block
blocksRouter.patch("/:blockId/reorder", reorderBlockController);

// Delete a block
blocksRouter.delete("/:blockId", deleteBlockController);
