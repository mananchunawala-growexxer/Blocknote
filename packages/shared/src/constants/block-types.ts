export const BLOCK_TYPES = [
  "paragraph",
  "heading_1",
  "heading_2",
  "todo",
  "code",
  "divider",
  "image",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
