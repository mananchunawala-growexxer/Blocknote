import type { Request, Response } from "express";
import { createBlockForUser, deleteBlockForUser, getDocumentBlocks, updateBlockForUser } from "./blocks.service.js";
import type { BlockType } from "@blocknote/shared";

function getRouteId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value ?? "";
}

/**
 * GET /api/documents/:documentId/blocks
 * List all blocks for a document
 */
export async function listBlocksController(req: Request, res: Response): Promise<void> {
  const documentId = getRouteId(req.params.documentId);
  const blocks = await getDocumentBlocks(req.auth!.id, documentId);
  res.status(200).json({ blocks });
}

/**
 * POST /api/blocks
 * Create a new block
 * Body: { documentId, type, content? }
 */
export async function createBlockController(req: Request, res: Response): Promise<void> {
  const { documentId, type, content } = req.body;
  const block = await createBlockForUser(req.auth!.id, documentId, type as BlockType, content);
  res.status(201).json({ block });
}

/**
 * PATCH /api/blocks/:blockId
 * Update a block's content or type
 * Body: { type?, content? }
 */
export async function updateBlockController(req: Request, res: Response): Promise<void> {
  const blockId = getRouteId(req.params.blockId);
  const { type, content } = req.body;
  const block = await updateBlockForUser(req.auth!.id, blockId, {
    type: type as BlockType | undefined,
    content,
  });
  res.status(200).json({ block });
}

/**
 * DELETE /api/blocks/:blockId
 * Delete a block
 */
export async function deleteBlockController(req: Request, res: Response): Promise<void> {
  const blockId = getRouteId(req.params.blockId);
  await deleteBlockForUser(req.auth!.id, blockId);
  res.status(204).send();
}
