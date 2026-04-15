import type { BlockDto } from "../types/block";

/**
 * CRITICAL: Split block at cursor position
 * Ensures NO text loss
 *
 * Rules:
 * - Text before cursor → stays in current block
 * - Text after cursor → moves to new block
 * - New block becomes paragraph type (always)
 * - Cursor moves to start of new block
 *
 * Example: Block "Hello|World" → ["Hello", "World"]
 */
export function splitBlock(
  block: BlockDto,
  cursorPosition: number,
  blocks: BlockDto[],
): {
  updatedBlock: BlockDto;
  newBlock: BlockDto;
} {
  const text = (block.content.text as string) ?? "";

  if (cursorPosition < 0 || cursorPosition > text.length) {
    throw new Error("Invalid cursor position");
  }

  const beforeCursor = text.slice(0, cursorPosition);
  const afterCursor = text.slice(cursorPosition);

  // Find this block's position in array to calculate order_index
  const blockIndex = blocks.findIndex((b) => b.id === block.id);
  if (blockIndex === -1) {
    throw new Error("Block not found in list");
  }

  // Calculate order_index between current and next block
  const currentOrderIndex = parseFloat(block.orderIndex);
  const nextBlock = blocks[blockIndex + 1];
  const nextOrderIndex = nextBlock ? parseFloat(nextBlock.orderIndex) : currentOrderIndex + 1000;
  const newOrderIndex = ((currentOrderIndex + nextOrderIndex) / 2).toFixed(10);

  const updatedBlock: BlockDto = {
    ...block,
    content: { text: beforeCursor },
  };

  const newBlock: BlockDto = {
    id: "", // Will be assigned by backend
    documentId: block.documentId,
    parentId: null,
    type: "paragraph",
    content: { text: afterCursor },
    orderIndex: newOrderIndex,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { updatedBlock, newBlock };
}

/**
 * Merge block with previous block
 * Moves current block's content to end of previous block
 * Deletes current block
 *
 * Example: ["Hello", "World"] + merge → ["HelloWorld"]
 *
 * Edge cases:
 * - If at first block → return null (can't merge)
 * - If previous is divider/image → handle gracefully (insert at position)
 */
export function mergeWithPrevious(
  block: BlockDto,
  previousBlock: BlockDto | null,
  blocks: BlockDto[],
): {
  mergedBlock: BlockDto;
  cursorPosition: number;
} | null {
  if (!previousBlock) {
    return null; // Can't merge if no previous block
  }

  // Handle special block types that can't be merged into
  if (previousBlock.type === "divider" || previousBlock.type === "image") {
    // For these types, just position cursor at start of current block
    return {
      mergedBlock: block,
      cursorPosition: 0,
    };
  }

  const currentText = (block.content.text as string) ?? "";
  const previousText = (previousBlock.content.text as string) ?? "";

  // Calculate cursor position: it will be at the end of merged text from previous block
  const cursorPosition = previousText.length;

  const mergedBlock: BlockDto = {
    ...previousBlock,
    content: {
      ...previousBlock.content,
      text: previousText + currentText,
    },
  };

  return { mergedBlock, cursorPosition };
}

/**
 * Create new block with empty content
 * Calculates order_index between provided positions
 */
export function createNewBlock(
  documentId: string,
  type: "paragraph" | "heading_1" | "heading_2" | "todo" | "code" | "divider" | "image",
  afterOrderIndex: number,
  beforeOrderIndex?: number,
): Omit<BlockDto, "id" | "createdAt" | "updatedAt"> {
  let newOrderIndex: number;

  if (beforeOrderIndex !== undefined) {
    // Insert between two blocks
    newOrderIndex = (afterOrderIndex + beforeOrderIndex) / 2;
  } else {
    // Append at end
    newOrderIndex = afterOrderIndex + 1000;
  }

  const defaultContent: Record<string, unknown> = { text: "" };
  if (type === "todo") {
    defaultContent.checked = false;
  } else if (type === "image") {
    defaultContent.url = "";
  }

  return {
    documentId,
    parentId: null,
    type,
    content: defaultContent,
    orderIndex: newOrderIndex.toFixed(10),
  };
}

/**
 * Get cursor position from contentEditable element
 * Returns -1 if no selection or error
 */
export function getCursorPosition(element: HTMLElement | null): number {
  if (!element) return -1;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return -1;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  return preCaretRange.toString().length;
}

/**
 * Set cursor position in contentEditable element
 * Useful for positioning cursor after operations like split/merge
 */
export function setCursorPosition(element: HTMLElement | null, position: number): void {
  if (!element) return;

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  let charCount = 0;
  let foundStart = false;

  const traverse = (node: Node): boolean => {
    if (foundStart) return true;

    if (node.nodeType === Node.TEXT_NODE) {
      if (charCount + node.textContent!.length >= position) {
        range.setStart(node, position - charCount);
        foundStart = true;
        return true;
      }
      charCount += node.textContent!.length;
    } else {
      for (const child of node.childNodes) {
        if (traverse(child)) return true;
      }
    }

    return false;
  };

  if (traverse(element)) {
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * Get text content from contentEditable element
 */
export function getBlockText(element: HTMLElement | null): string {
  if (!element) return "";
  return element.textContent ?? "";
}

/**
 * Set text content in contentEditable element
 */
export function setBlockText(element: HTMLElement | null, text: string): void {
  if (!element) return;
  element.textContent = text;
}

/**
 * Check if block is at end of text (cursor after last character)
 */
export function isCursorAtEnd(element: HTMLElement | null): boolean {
  const position = getCursorPosition(element);
  const text = getBlockText(element);
  return position === text.length;
}

/**
 * Check if block is at start of text (cursor before first character)
 */
export function isCursorAtStart(element: HTMLElement | null): boolean {
  return getCursorPosition(element) === 0;
}

/**
 * Check if block is empty
 */
export function isBlockEmpty(block: BlockDto): boolean {
  const text = (block.content.text as string) ?? "";
  return text.trim().length === 0;
}
