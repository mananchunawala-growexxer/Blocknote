import {
  ERROR_CODES,
  createDocumentSchema,
  type DocumentDetailResponse,
  type DocumentListResponse,
  updateDocumentSchema,
} from "@blocknote/shared";
import { DEFAULT_DOCUMENT_TITLE, INITIAL_BLOCK_ORDER_INDEX } from "../../constants/documents.js";
import { pool } from "../../lib/db.js";
import { ApiError } from "../../lib/api-error.js";
import {
  createBlock,
  createDocument,
  deleteDocument,
  findDocumentByIdForUser,
  listBlocksByDocumentId,
  listDocumentsByUserId,
  updateDocumentTitle,
} from "./documents.repository.js";

export async function listDocuments(userId: string): Promise<DocumentListResponse> {
  const documents = await listDocumentsByUserId(userId);

  return {
    items: documents.map((document) => ({
      id: document.id,
      title: document.title,
      updatedAt: document.updated_at.toISOString(),
      createdAt: document.created_at.toISOString(),
    })),
  };
}

export async function createDocumentWithInitialBlock(userId: string, title: string | undefined) {
  const parsed = createDocumentSchema.parse({
    title: title?.trim() || DEFAULT_DOCUMENT_TITLE,
  });

  const client = await pool.connect();

  try {
    await client.query("begin");
    const document = await createDocument(userId, parsed.title, client);
    await createBlock(
      {
        documentId: document.id,
        parentId: null,
        type: "paragraph",
        contentJson: { text: "" },
        orderIndex: INITIAL_BLOCK_ORDER_INDEX,
      },
      client,
    );
    await client.query("commit");

    return {
      id: document.id,
      title: document.title,
      updatedAt: document.updated_at.toISOString(),
      createdAt: document.created_at.toISOString(),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function renameDocumentForUser(userId: string, documentId: string, title: string) {
  const parsed = updateDocumentSchema.parse({ title });
  const document = await updateDocumentTitle(documentId, userId, parsed.title);

  if (!document) {
    throw new ApiError(403, ERROR_CODES.DOCUMENT_FORBIDDEN, "You do not have access to this document");
  }

  return {
    id: document.id,
    title: document.title,
    updatedAt: document.updated_at.toISOString(),
    createdAt: document.created_at.toISOString(),
  };
}

export async function deleteDocumentForUser(userId: string, documentId: string): Promise<void> {
  const existing = await findDocumentByIdForUser(documentId, userId);
  if (!existing) {
    throw new ApiError(403, ERROR_CODES.DOCUMENT_FORBIDDEN, "You do not have access to this document");
  }

  await deleteDocument(documentId, userId);
}

export async function getDocumentDetailForUser(userId: string, documentId: string): Promise<DocumentDetailResponse> {
  const document = await findDocumentByIdForUser(documentId, userId);
  if (!document) {
    throw new ApiError(403, ERROR_CODES.DOCUMENT_FORBIDDEN, "You do not have access to this document");
  }

  const blocks = await listBlocksByDocumentId(document.id);

  return {
    document: {
      id: document.id,
      title: document.title,
      updatedAt: document.updated_at.toISOString(),
      createdAt: document.created_at.toISOString(),
      currentVersion: document.current_version,
      isPublic: document.is_public,
    },
    blocks: blocks.map((block) => ({
      id: block.id,
      documentId: block.document_id,
      parentId: block.parent_id,
      type: block.type,
      content: block.content_json,
      orderIndex: block.order_index,
      createdAt: block.created_at.toISOString(),
      updatedAt: block.updated_at.toISOString(),
    })),
  };
}
