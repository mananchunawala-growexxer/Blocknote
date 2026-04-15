import {
  ERROR_CODES,
  createDocumentSchema,
  type DocumentShareResponse,
  type DocumentDetailResponse,
  type DocumentListResponse,
  updateDocumentSchema,
} from "@blocknote/shared";
import { z } from "zod";
import { DEFAULT_DOCUMENT_TITLE, INITIAL_BLOCK_ORDER_INDEX } from "../../constants/documents.js";
import { pool } from "../../lib/db.js";
import { ApiError } from "../../lib/api-error.js";
import { generateToken } from "../../lib/crypto.js";
import {
  createBlock,
  createDocument,
  deleteDocument,
  findDocumentByShareTokenHash,
  findDocumentByIdForUser,
  listBlocksByDocumentId,
  listDocumentsByUserId,
  updateDocumentShareSettings,
  updateDocumentTitle,
} from "./documents.repository.js";

const updateDocumentShareSchemaLocal = z.object({
  isPublic: z.boolean(),
});

function mapDocumentSummary(document: {
  id: string;
  title: string;
  updated_at: Date;
  created_at: Date;
  is_public: boolean;
}, shareToken: string | null = null) {
  return {
    id: document.id,
    title: document.title,
    updatedAt: document.updated_at.toISOString(),
    createdAt: document.created_at.toISOString(),
    isPublic: document.is_public,
    shareToken,
    shareUrl: shareToken ? `/shared/${shareToken}` : null,
  };
}

export async function listDocuments(userId: string): Promise<DocumentListResponse> {
  const documents = await listDocumentsByUserId(userId);

  return {
    items: documents.map((document) => mapDocumentSummary(document, document.is_public ? document.share_token_hash : null)),
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

    return mapDocumentSummary(document);
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
    ...mapDocumentSummary(document),
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
      ...mapDocumentSummary(document, document.is_public ? document.share_token_hash : null),
      currentVersion: document.current_version,
      isPublic: document.is_public,
      shareToken: document.is_public ? document.share_token_hash : null,
      shareUrl: document.is_public && document.share_token_hash ? `/shared/${document.share_token_hash}` : null,
      viewerRole: "owner",
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

export async function getSharedDocumentDetail(shareToken: string): Promise<DocumentDetailResponse> {
  const token = shareToken.trim();
  if (!token) {
    throw new ApiError(404, ERROR_CODES.DOCUMENT_NOT_FOUND, "Shared document not found");
  }

  const document = await findDocumentByShareTokenHash(token);
  if (!document) {
    throw new ApiError(404, ERROR_CODES.DOCUMENT_NOT_FOUND, "Shared document not found");
  }

  const blocks = await listBlocksByDocumentId(document.id);

  return {
    document: {
      ...mapDocumentSummary(document, token),
      currentVersion: document.current_version,
      isPublic: document.is_public,
      shareToken: token,
      shareUrl: `/shared/${token}`,
      viewerRole: "shared_reader",
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

export async function updateDocumentShareForUser(
  userId: string,
  documentId: string,
  input: { isPublic: boolean },
): Promise<DocumentShareResponse> {
  const parsed = updateDocumentShareSchemaLocal.parse(input);
  const shareToken = parsed.isPublic ? generateToken() : null;
  const document = await updateDocumentShareSettings(documentId, userId, {
    isPublic: parsed.isPublic,
    shareTokenHash: shareToken,
  });

  if (!document) {
    throw new ApiError(403, ERROR_CODES.DOCUMENT_FORBIDDEN, "You do not have access to this document");
  }

  return {
    document: {
      id: document.id,
      isPublic: document.is_public,
      shareToken,
      shareUrl: shareToken ? `/shared/${shareToken}` : null,
    },
  };
}
