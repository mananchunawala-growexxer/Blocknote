import type {
  AuthResponse,
  DocumentShareResponse,
  DocumentListResponse,
  DocumentDetailResponse,
  DocumentResponse,
  BlockDto,
} from "@blocknote/shared";
import type { BlockType } from "@blocknote/shared";
import { sessionStore } from "../stores/session";

export interface BlockListResponse {
  blocks: BlockDto[];
}

export interface BlockResponse {
  block: BlockDto;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const NORMALIZED_API_BASE_URL = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL
  : `${API_BASE_URL.replace(/\/+$/, "")}/api`;

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = sessionStore.getSnapshot().accessToken;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${NORMALIZED_API_BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiRequestError("Network error. Please verify API URL and CORS configuration.");
  }

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    let errorMessage = "Request failed";

    if (responseText) {
      try {
        const parsed = JSON.parse(responseText) as { message?: string };
        errorMessage = parsed.message ?? errorMessage;
      } catch {
        errorMessage = responseText.slice(0, 200);
      }
    }

    throw new ApiRequestError(errorMessage, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function register(input: { email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getDocuments(): Promise<DocumentListResponse> {
  return request<DocumentListResponse>("/documents");
}

export async function createDocument(input: { title: string }) {
  return request<DocumentResponse>("/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function renameDocument(input: { id: string; title: string }) {
  return request<DocumentResponse>(`/documents/${input.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title: input.title }),
  });
}

export async function deleteDocument(id: string) {
  return request<void>(`/documents/${id}`, {
    method: "DELETE",
  });
}

export async function getDocumentDetail(documentId: string): Promise<DocumentDetailResponse> {
  return request<DocumentDetailResponse>(`/documents/${documentId}`);
}

export async function getSharedDocumentDetail(shareToken: string): Promise<DocumentDetailResponse> {
  return request<DocumentDetailResponse>(`/documents/shared/${shareToken}`);
}

export async function updateDocumentShare(input: { id: string; isPublic: boolean }): Promise<DocumentShareResponse> {
  return request<DocumentShareResponse>(`/documents/${input.id}/share`, {
    method: "PATCH",
    body: JSON.stringify({ isPublic: input.isPublic }),
  });
}

// ==================== BLOCK ENDPOINTS ====================

export async function getDocumentBlocks(documentId: string): Promise<BlockListResponse> {
  try {
    return await request<BlockListResponse>(`/blocks/documents/${documentId}/blocks`);
  } catch (error) {
    // Backward-compatible fallback for deployments where block routes are unavailable.
    if (error instanceof ApiRequestError && error.status === 404) {
      const documentDetail = await request<DocumentDetailResponse>(`/documents/${documentId}`);
      return { blocks: documentDetail.blocks };
    }
    throw error;
  }
}

export async function createBlock(input: {
  documentId: string;
  type: BlockType;
  content?: Record<string, unknown>;
}): Promise<BlockResponse> {
  return request<BlockResponse>("/blocks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateBlock(input: {
  blockId: string;
  type?: BlockType;
  content?: Record<string, unknown>;
}): Promise<BlockResponse> {
  return request<BlockResponse>(`/blocks/${input.blockId}`, {
    method: "PATCH",
    body: JSON.stringify({
      type: input.type,
      content: input.content,
    }),
  });
}

export async function reorderBlock(input: {
  blockId: string;
  afterOrderIndex: string;
  beforeOrderIndex?: string;
}): Promise<BlockResponse> {
  return request<BlockResponse>(`/blocks/${input.blockId}/reorder`, {
    method: "PATCH",
    body: JSON.stringify({
      afterOrderIndex: input.afterOrderIndex,
      beforeOrderIndex: input.beforeOrderIndex,
    }),
  });
}

export async function deleteBlock(blockId: string): Promise<void> {
  return request<void>(`/blocks/${blockId}`, {
    method: "DELETE",
  });
}
