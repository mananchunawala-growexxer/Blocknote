export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

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

export interface BlockDto {
  id: string;
  documentId: string;
  parentId: string | null;
  type: string;
  content: Record<string, unknown>;
  orderIndex: string;
  createdAt: string;
  updatedAt: string;
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
