import type {
  AuthResponse,
  DocumentListResponse,
  DocumentResponse,
  BlockListResponse,
  BlockResponse,
  BlockDto,
} from "@blocknote/shared";
import type { BlockType } from "@blocknote/shared";
import { sessionStore } from "../stores/session";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = sessionStore.getSnapshot().accessToken;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message ?? "Request failed");
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

// ==================== BLOCK ENDPOINTS ====================

export async function getDocumentBlocks(documentId: string): Promise<BlockListResponse> {
  return request<BlockListResponse>(`/blocks/documents/${documentId}/blocks`);
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

export async function deleteBlock(blockId: string): Promise<void> {
  return request<void>(`/blocks/${blockId}`, {
    method: "DELETE",
  });
}
