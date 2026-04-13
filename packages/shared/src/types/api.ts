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
  };
  blocks: BlockDto[];
}
