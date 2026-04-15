import { sessionStore } from "../stores/session";
import type { BlockDto, BlockType } from "../types/block";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  isPublic?: boolean;
  shareToken?: string | null;
  shareUrl?: string | null;
}

export interface DocumentListResponse {
  items: DocumentListItem[];
}

export interface DocumentResponse {
  document: DocumentListItem;
}

export interface DocumentDetailResponse {
  document: {
    id: string;
    title: string;
    updatedAt: string;
    createdAt: string;
    currentVersion: number;
    isPublic: boolean;
    shareToken: string | null;
    shareUrl: string | null;
    viewerRole: "owner" | "shared_reader";
  };
  blocks: BlockDto[];
}

export interface DocumentShareResponse {
  document: {
    id: string;
    isPublic: boolean;
    shareToken: string | null;
    shareUrl: string | null;
  };
}

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
  const path = `/documents/${input.id}/share`;
  const body = JSON.stringify({ isPublic: input.isPublic });

  const methods: Array<"PATCH" | "POST" | "PUT"> = ["PATCH", "POST", "PUT"];
  let lastError: unknown = null;

  for (const method of methods) {
    try {
      return await request<DocumentShareResponse>(path, {
        method,
        body,
      });
    } catch (error) {
      lastError = error;
      // Only continue fallback attempts when route/method does not exist.
      if (error instanceof ApiRequestError && (error.status === 404 || error.status === 405)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new ApiRequestError("Share endpoint is not available on the deployed backend.");
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
