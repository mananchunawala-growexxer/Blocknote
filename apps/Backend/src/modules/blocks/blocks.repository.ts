import { pool } from "../../lib/db.js";
import type { BlockRecord } from "../documents/documents.repository.js";

/**
 * Get a single block by ID with document ownership verification
 * Used to ensure user has access to this block before operations
 */
export async function getBlockByIdWithOwnership(
  blockId: string,
  userId: string,
): Promise<BlockRecord | null> {
  const result = await pool.query<BlockRecord>(
    `select b.id, b.document_id, b.parent_id, b.type, b.content_json, b.order_index, b.created_at, b.updated_at
     from blocks b
     join documents d on b.document_id = d.id
     where b.id = $1 and d.user_id = $2`,
    [blockId, userId],
  );

  return result.rows[0] ?? null;
}

/**
 * Update block content and/or type
 * Maintains order_index and created_at
 */
export async function updateBlock(
  blockId: string,
  userId: string,
  updates: {
    type?: string;
    content_json?: Record<string, unknown>;
  },
): Promise<BlockRecord | null> {
  const setClauses: string[] = [];
  const params: (string | Record<string, unknown>)[] = [blockId, userId];

  if (updates.type !== undefined) {
    setClauses.push(`type = $${params.length + 1}`);
    params.push(updates.type);
  }

  if (updates.content_json !== undefined) {
    setClauses.push(`content_json = $${params.length + 1}::jsonb`);
    params.push(updates.content_json);
  }

  if (setClauses.length === 0) {
    // No updates, just fetch the block
    return getBlockByIdWithOwnership(blockId, userId);
  }

  setClauses.push(`updated_at = now()`);

  const result = await pool.query<BlockRecord>(
    `update blocks
     set ${setClauses.join(", ")}
     where id = $1 and document_id in (
       select id from documents where user_id = $2
     )
     returning id, document_id, parent_id, type, content_json, order_index, created_at, updated_at`,
    params,
  );

  return result.rows[0] ?? null;
}

/**
 * Delete a block (with cascade for nested blocks)
 * Document ownership is verified through the document_id foreign key
 */
export async function deleteBlockWithOwnership(blockId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `delete from blocks
     where id = $1
     and document_id in (select id from documents where user_id = $2)`,
    [blockId, userId],
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Update order_index for reordering operations
 * Used for inserting/moving blocks between positions
 */
export async function updateBlockOrderIndex(
  blockId: string,
  userId: string,
  newOrderIndex: string,
): Promise<BlockRecord | null> {
  const result = await pool.query<BlockRecord>(
    `update blocks
     set order_index = $3, updated_at = now()
     where id = $1
     and document_id in (select id from documents where user_id = $2)
     returning id, document_id, parent_id, type, content_json, order_index, created_at, updated_at`,
    [blockId, userId, newOrderIndex],
  );

  return result.rows[0] ?? null;
}
