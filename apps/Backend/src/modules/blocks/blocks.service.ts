import { ERROR_CODES, BLOCK_TYPES, type BlockType } from "@blocknote/shared";
import { ApiError } from "../../lib/api-error.js";
import { findDocumentByIdForUser, listBlocksByDocumentId, createBlock } from "../documents/documents.repository.js";
import {
  getBlockByIdWithOwnership,
  updateBlock,
  deleteBlockWithOwnership,
  updateBlockOrderIndex,
} from "./blocks.repository.js";
import type { BlockRecord } from "../documents/documents.repository.js";

/**
 * Maximum gap between order_index values for inserting new blocks
 * Using 1000 as the gap to allow 1000 positions between any two blocks
 */
const BLOCK_ORDER_GAP = 1000;

/**
 * Calculate new order_index between two blocks
 * For inserting at the beginning: useAfterIndex as 0
 * For appending: uses the last block's order_index
 */
function calculateNewOrderIndex(afterIndex: string, beforeIndex?: string): string {
  const after = parseFloat(afterIndex);
  if (!beforeIndex) {
    // Appending: new order = after + gap
    return (after + BLOCK_ORDER_GAP).toFixed(10);
  }

  const before = parseFloat(beforeIndex);
  if (after >= before) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid order index range");
  }

  // Inserting between: new order = (after + before) / 2
  const newIndex = (after + before) / 2;
  return newIndex.toFixed(10);
}

/**
 * Get all blocks for a document (with ownership check)
 */
export async function getDocumentBlocks(userId: string, documentId: string) {
  const document = await findDocumentByIdForUser(documentId, userId);
  if (!document) {
    throw new ApiError(403, ERROR_CODES.DOCUMENT_FORBIDDEN, "You do not have access to this document");
  }

  const blocks = await listBlocksByDocumentId(documentId);
  return blocks.map(mapBlockRecord);
}

/**
 * Create a new block in a document
 * Automatically calculates order_index to append at the end
 */
export async function createBlockForUser(
  userId: string,
  documentId: string,
  type: BlockType,
  content?: Record<string, unknown>,
) {
  // Verify document ownership
  const document = await findDocumentByIdForUser(documentId, userId);
  if (!document) {
    throw new ApiError(403, ERROR_CODES.DOCUMENT_FORBIDDEN, "You do not have access to this document");
  }

  // Validate block type
  if (!BLOCK_TYPES.includes(type)) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid block type: ${type}`);
  }

  // Get existing blocks to calculate order index
  const existingBlocks = await listBlocksByDocumentId(documentId);
  const lastBlock = existingBlocks.length > 0 ? existingBlocks[existingBlocks.length - 1] : null;
  const lastOrderIndex = lastBlock?.order_index ?? "0";

  // Calculate new order index
  const newOrderIndex = calculateNewOrderIndex(lastOrderIndex);

  // Create block with default content based on type
  const defaultContent: Record<string, unknown> = {
    text: "",
  };

  if (type === "todo") {
    defaultContent.checked = false;
  } else if (type === "image") {
    defaultContent.url = "";
  }

  const contentJson = content ?? defaultContent;

  const block = await createBlock(
    {
      documentId,
      parentId: null,
      type,
      contentJson,
      orderIndex: newOrderIndex,
    },
  );

  return mapBlockRecord(block);
}

/**
 * Update a block's content or type
 */
export async function updateBlockForUser(
  userId: string,
  blockId: string,
  updates: {
    type?: BlockType;
    content?: Record<string, unknown>;
  },
) {
  // Verify ownership
  const block = await getBlockByIdWithOwnership(blockId, userId);
  if (!block) {
    throw new ApiError(403, ERROR_CODES.BLOCK_FORBIDDEN, "You do not have access to this block");
  }

  // Validate new type if provided
  if (updates.type && !BLOCK_TYPES.includes(updates.type)) {
    throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid block type: ${updates.type}`);
  }

  const updatePayload: { type?: string; content_json?: Record<string, unknown> } = {};
  if (updates.type) updatePayload.type = updates.type;
  if (updates.content !== undefined) updatePayload.content_json = updates.content;

  const updated = await updateBlock(blockId, userId, updatePayload);
  if (!updated) {
    throw new ApiError(403, ERROR_CODES.BLOCK_FORBIDDEN, "Could not update block");
  }

  return mapBlockRecord(updated);
}

/**
 * Delete a block (cascades to nested blocks)
 */
export async function deleteBlockForUser(userId: string, blockId: string) {
  // Verify ownership
  const block = await getBlockByIdWithOwnership(blockId, userId);
  if (!block) {
    throw new ApiError(403, ERROR_CODES.BLOCK_FORBIDDEN, "You do not have access to this block");
  }

  const deleted = await deleteBlockWithOwnership(blockId, userId);
  if (!deleted) {
    throw new ApiError(403, ERROR_CODES.BLOCK_FORBIDDEN, "Could not delete block");
  }
}

/**
 * Reorder a block to a new position
 * Pass afterOrderIndex and optionally beforeOrderIndex for the range where it should be inserted
 */
export async function reorderBlockForUser(
  userId: string,
  blockId: string,
  afterOrderIndex: string,
  beforeOrderIndex?: string,
) {
  // Verify ownership
  const block = await getBlockByIdWithOwnership(blockId, userId);
  if (!block) {
    throw new ApiError(403, ERROR_CODES.BLOCK_FORBIDDEN, "You do not have access to this block");
  }

  // Calculate new position
  const newOrderIndex = calculateNewOrderIndex(afterOrderIndex, beforeOrderIndex);

  // Update order_index
  const updated = await updateBlockOrderIndex(blockId, userId, newOrderIndex);
  if (!updated) {
    throw new ApiError(403, ERROR_CODES.BLOCK_FORBIDDEN, "Could not reorder block");
  }

  return mapBlockRecord(updated);
}

/**
 * Map database record to API response format
 * Converts snake_case DB fields to camelCase API fields
 */
function mapBlockRecord(block: BlockRecord) {
  return {
    id: block.id,
    documentId: block.document_id,
    parentId: block.parent_id,
    type: block.type,
    content: block.content_json,
    orderIndex: block.order_index,
    createdAt: block.created_at.toISOString(),
    updatedAt: block.updated_at.toISOString(),
  };
}
