import type { PoolClient } from "pg";
import { pool } from "../../lib/db.js";

export interface DocumentRecord {
  id: string;
  user_id: string;
  title: string;
  is_public: boolean;
  share_token_hash: string | null;
  current_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface BlockRecord {
  id: string;
  document_id: string;
  parent_id: string | null;
  type: string;
  content_json: Record<string, unknown>;
  order_index: string;
  created_at: Date;
  updated_at: Date;
}

export async function listDocumentsByUserId(userId: string): Promise<DocumentRecord[]> {
  const result = await pool.query<DocumentRecord>(
    `select id, user_id, title, is_public, share_token_hash, current_version, created_at, updated_at
     from documents
     where user_id = $1
     order by updated_at desc`,
    [userId],
  );

  return result.rows;
}

export async function createDocument(userId: string, title: string, client?: PoolClient): Promise<DocumentRecord> {
  const executor = client ?? pool;
  const result = await executor.query<DocumentRecord>(
    `insert into documents (user_id, title)
     values ($1, $2)
     returning id, user_id, title, is_public, share_token_hash, current_version, created_at, updated_at`,
    [userId, title],
  );

  return result.rows[0];
}

export async function createBlock(
  input: {
    documentId: string;
    parentId: string | null;
    type: string;
    contentJson: Record<string, unknown>;
    orderIndex: string;
  },
  client?: PoolClient,
): Promise<BlockRecord> {
  const executor = client ?? pool;
  const result = await executor.query<BlockRecord>(
    `insert into blocks (document_id, parent_id, type, content_json, order_index)
     values ($1, $2, $3, $4::jsonb, $5)
     returning id, document_id, parent_id, type, content_json, order_index, created_at, updated_at`,
    [input.documentId, input.parentId, input.type, JSON.stringify(input.contentJson), input.orderIndex],
  );

  return result.rows[0];
}

export async function findDocumentByIdForUser(documentId: string, userId: string): Promise<DocumentRecord | null> {
  const result = await pool.query<DocumentRecord>(
    `select id, user_id, title, is_public, share_token_hash, current_version, created_at, updated_at
     from documents
     where id = $1 and user_id = $2`,
    [documentId, userId],
  );

  return result.rows[0] ?? null;
}

export async function findDocumentByShareTokenHash(shareTokenHash: string): Promise<DocumentRecord | null> {
  const result = await pool.query<DocumentRecord>(
    `select id, user_id, title, is_public, share_token_hash, current_version, created_at, updated_at
     from documents
     where is_public = true and share_token_hash = $1`,
    [shareTokenHash],
  );

  return result.rows[0] ?? null;
}

export async function listBlocksByDocumentId(documentId: string): Promise<BlockRecord[]> {
  const result = await pool.query<BlockRecord>(
    `select id, document_id, parent_id, type, content_json, order_index, created_at, updated_at
     from blocks
     where document_id = $1
     order by order_index asc, created_at asc`,
    [documentId],
  );

  return result.rows;
}

export async function updateDocumentTitle(
  documentId: string,
  userId: string,
  title: string,
): Promise<DocumentRecord | null> {
  const result = await pool.query<DocumentRecord>(
    `update documents
     set title = $3, updated_at = now()
     where id = $1 and user_id = $2
     returning id, user_id, title, is_public, share_token_hash, current_version, created_at, updated_at`,
    [documentId, userId, title],
  );

  return result.rows[0] ?? null;
}

export async function updateDocumentShareSettings(
  documentId: string,
  userId: string,
  input: {
    isPublic: boolean;
    shareTokenHash: string | null;
  },
): Promise<DocumentRecord | null> {
  const result = await pool.query<DocumentRecord>(
    `update documents
     set is_public = $3, share_token_hash = $4, updated_at = now()
     where id = $1 and user_id = $2
     returning id, user_id, title, is_public, share_token_hash, current_version, created_at, updated_at`,
    [documentId, userId, input.isPublic, input.shareTokenHash],
  );

  return result.rows[0] ?? null;
}

export async function touchDocumentById(documentId: string): Promise<void> {
  await pool.query(
    `update documents
     set updated_at = now()
     where id = $1`,
    [documentId],
  );
}

export async function deleteDocument(documentId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `delete from documents
     where id = $1 and user_id = $2`,
    [documentId, userId],
  );

  return (result.rowCount ?? 0) > 0;
}
