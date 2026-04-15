export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "todo"
  | "code"
  | "divider"
  | "image";

export interface BlockDto {
  id: string;
  documentId: string;
  parentId: string | null;
  type: BlockType;
  content: Record<string, unknown>;
  orderIndex: string;
  createdAt: string;
  updatedAt: string;
}
