import React, { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlockDto, BlockType } from "@blocknote/shared";
import {
  getDocumentBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
} from "../lib/api";
import { Block } from "./Block";
import { SlashMenu } from "./SlashMenu";
import {
  splitBlock,
  mergeWithPrevious,
  createNewBlock,
  getCursorPosition,
  setCursorPosition,
  isBlockEmpty,
} from "../utils/blockUtils";

interface BlockEditorProps {
  documentId: string;
}

/**
 * BlockEditor manages all blocks for a document
 * Handles:
 * - Fetching blocks from backend
 * - Updating state on local changes
 * - Syncing changes to backend
 * - Enter key split logic (NO TEXT LOSS)
 * - Backspace merge logic (with edge cases)
 * - Slash command menu
 */
export const BlockEditor: React.FC<BlockEditorProps> = ({ documentId }) => {
  const queryClient = useQueryClient();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 140, left: 140 });

  // Fetch blocks for document
  const blocksQuery = useQuery({
    queryKey: ["documents", documentId, "blocks"],
    queryFn: () => getDocumentBlocks(documentId),
  });

  const blocks = blocksQuery.data?.blocks ?? [];

  // Mutations for block operations
  const createBlockMutation = useMutation({
    mutationFn: (data: {
      documentId: string;
      type: BlockType;
      content?: Record<string, unknown>;
    }) => createBlock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", documentId, "blocks"] });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: (data: {
      blockId: string;
      type?: BlockType;
      content?: Record<string, unknown>;
    }) => updateBlock(data),
    onSuccess: (_, variables) => {
      if (variables.type === undefined) {
        // purely content change (e.g. typing) - do not invalidate to prevent cursor freezing
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["documents", documentId, "blocks"] });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => deleteBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", documentId, "blocks"] });
    },
  });

  /**
   * CRITICAL: Handle Enter key
   * Rule: If at end of block → create new paragraph below
   * Rule: If in middle → split block (NO TEXT LOSS)
   *
   * Process:
   * 1. Get text before and after cursor
   * 2. Update current block with text before
   * 3. Create new block with text after
   * 4. Focus moves to new block start
   */
  const handleEnter = useCallback(
    async (blockId: string, cursorPosition: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      const text = (block.content.text as string) ?? "";

      // If at end → just create new paragraph
      if (cursorPosition === text.length) {
        const newBlock = createNewBlock("paragraph", "paragraph", parseFloat(block.orderIndex));
        const response = await createBlockMutation.mutateAsync({
          documentId,
          type: "paragraph",
          content: newBlock.content,
        });

        // Move focus to the new block
        const newBlockId = response.block.id;
        setSelectedBlockId(newBlockId);
        setTimeout(() => {
          const element = document.querySelector(`[data-block-id="${newBlockId}"]`) as HTMLElement;
          if (element) {
            setCursorPosition(element, 0);
            element.focus();
          }
        }, 100);

        return;
      }

      // Split block (critical: no text loss)
      const { updatedBlock, newBlock } = splitBlock(block, cursorPosition, blocks);

      // Update current block
      await updateBlockMutation.mutateAsync({
        blockId: block.id,
        content: updatedBlock.content,
      });

      // Create new block with text after cursor
      const response = await createBlockMutation.mutateAsync({
        documentId,
        type: "paragraph",
        content: newBlock.content,
      });

      // Move focus to the new block
      const newBlockId = response.block.id;
      setSelectedBlockId(newBlockId);
      setTimeout(() => {
        const element = document.querySelector(`[data-block-id="${newBlockId}"]`) as HTMLElement;
        if (element) {
          setCursorPosition(element, 0);
          element.focus();
        }
      }, 100);
    },
    [blocks, documentId, createBlockMutation, updateBlockMutation],
  );

  /**
   * CRITICAL: Handle Backspace at start of block
   * Rule: Merge with previous block
   * Rule: If first block → do nothing (safe)
   * Rule: If previous is divider/image → handle gracefully
   *
   * Process:
   * 1. Find previous block
   * 2. Merge current content to end of previous
   * 3. Delete current block
   * 4. Focus moves to cursor position in merged block
   */
  const handleBackspace = useCallback(
    async (blockId: string) => {
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex <= 0) return; // First block or not found

      const currentBlock = blocks[blockIndex];
      const previousBlock = blocks[blockIndex - 1];

      if (!currentBlock || !previousBlock) return;

      // Rule: If previous is divider/image → handle gracefully
      if (previousBlock.type === "divider" || previousBlock.type === "image") {
        if (isBlockEmpty(currentBlock)) {
          await deleteBlockMutation.mutateAsync(currentBlock.id);
          setSelectedBlockId(previousBlock.id);
        }
        return;
      }

      // Rule: At start of NON-EMPTY block → NO action OR convert to paragraph
      if (!isBlockEmpty(currentBlock)) {
        if (currentBlock.type !== "paragraph") {
          await updateBlockMutation.mutateAsync({
            blockId: currentBlock.id,
            type: "paragraph",
          });
        }
        return;
      }

      const mergeResult = mergeWithPrevious(currentBlock, previousBlock, blocks);
      if (!mergeResult) return;

      const { mergedBlock, cursorPosition } = mergeResult;

      // Update merged block with combined content
      await updateBlockMutation.mutateAsync({
        blockId: previousBlock.id,
        content: mergedBlock.content,
      });

      // Delete current block
      await deleteBlockMutation.mutateAsync(currentBlock.id);

      // Select merged block and restore cursor position
      setSelectedBlockId(previousBlock.id);
      setTimeout(() => {
        const element = document.querySelector(`[data-block-id="${previousBlock.id}"]`) as HTMLElement;
        if (element) {
          setCursorPosition(element, cursorPosition);
          element.focus();
        }
      }, 100);
    },
    [blocks, updateBlockMutation, deleteBlockMutation],
  );

  const getAutoTransform = useCallback((text: string, currentType: string) => {
    if (currentType !== "paragraph") {
      return null;
    }

    if (text === "# ") {
      return { type: "heading_1" as BlockType, content: { text: "", html: "" } };
    }

    if (text === "## ") {
      return { type: "heading_2" as BlockType, content: { text: "", html: "" } };
    }

    if (text === "[] " || text === "[ ] " || text === "- [ ] ") {
      return { type: "todo" as BlockType, content: { text: "", html: "", checked: false } };
    }

    if (text === "```" || text === "``` ") {
      return { type: "code" as BlockType, content: { text: "", html: "" } };
    }

    if (text.trim() === "---") {
      return { type: "divider" as BlockType, content: { text: "", html: "" } };
    }

    return null;
  }, []);

  /**
   * Handle content changes
   * Updates block content and syncs to backend
   */
  const handleContentChange = useCallback(
    (blockId: string, contentPatch: Record<string, unknown>) => {
      const block = blocks.find((b) => b.id === blockId);
      const mergedContent: Record<string, unknown> = {
        ...(block?.content ?? {}),
        ...contentPatch,
      };

      const nextText = mergedContent.text;
      if (typeof nextText === "string" && block) {
        const transform = getAutoTransform(nextText, block.type);
        if (transform) {
          const transformedContent = {
            ...mergedContent,
            ...transform.content,
          };

          queryClient.setQueryData(["documents", documentId, "blocks"], (old: any) =>
            old && {
              ...old,
              blocks: old.blocks.map((b: BlockDto) =>
                b.id === blockId ? { ...b, type: transform.type, content: transformedContent } : b,
              ),
            },
          );

          updateBlockMutation.mutate({
            blockId,
            type: transform.type,
            content: transformedContent,
          });
          return;
        }
      }

      // Update local state immediately for responsiveness
      queryClient.setQueryData(
        ["documents", documentId, "blocks"],
        (old: any) =>
          old && {
            ...old,
            blocks: old.blocks.map((b: BlockDto) =>
              b.id === blockId ? { ...b, content: mergedContent } : b,
            ),
          },
      );

      // Debounced sync to backend
      const timeout = setTimeout(() => {
        updateBlockMutation.mutate({
          blockId,
          content: mergedContent,
        });
      }, 500);

      return () => clearTimeout(timeout);
    },
    [blocks, documentId, getAutoTransform, queryClient, updateBlockMutation],
  );

  /**
   * Handle slash command menu
   * Opens menu for block type selection
   */
  const handleSlash = useCallback((blockId: string) => {
    const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
    if (blockElement) {
      const rect = blockElement.getBoundingClientRect();
      const menuWidth = 320;
      const top = Math.min(window.innerHeight - 220, rect.bottom + 8);
      const left = Math.min(window.innerWidth - menuWidth - 16, Math.max(16, rect.left + 24));
      setSlashMenuPosition({ top, left });
    }

    setSelectedBlockId(blockId);
    setSlashMenuBlockId(blockId);
  }, []);

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      const blockIndex = blocks.findIndex((b) => b.id === blockId);
      if (blockIndex === -1) return;

      if (blocks.length === 1) {
        await updateBlockMutation.mutateAsync({
          blockId,
          type: "paragraph",
          content: { text: "", html: "" },
        });
        setSelectedBlockId(blockId);
        return;
      }

      const nextFocusBlock = blocks[blockIndex + 1] ?? blocks[blockIndex - 1] ?? null;
      await deleteBlockMutation.mutateAsync(blockId);
      if (nextFocusBlock) {
        setSelectedBlockId(nextFocusBlock.id);
      }
    },
    [blocks, deleteBlockMutation, updateBlockMutation],
  );

  /**
   * Handle block type change from slash menu
   */
  const handleChangeBlockType = useCallback(
    async (blockId: string, newType: BlockType) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;

      // Reset slash menu
      setSlashMenuBlockId(null);

      // Create appropriate default content for new type
      const defaultContent: Record<string, unknown> = { text: "", html: "" };
      if (newType === "todo") {
        defaultContent.checked = false;
      } else if (newType === "image") {
        defaultContent.url = "";
      }

      // Update block type
      await updateBlockMutation.mutateAsync({
        blockId,
        type: newType,
        content: defaultContent,
      });

      setSelectedBlockId(blockId);
      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
        const editable = blockElement?.querySelector("[contenteditable='true']") as HTMLElement | null;
        const input = blockElement?.querySelector("input[type='text']") as HTMLInputElement | null;

        if (editable) {
          editable.focus();
          setCursorPosition(editable, 0);
          return;
        }

        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    },
    [blocks, updateBlockMutation],
  );

  // Set first block as selected by default (MUST be before any early returns)
  useEffect(() => {
    if (blocks.length > 0 && !selectedBlockId) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  // Close slash menu if selection changes (e.g. clicking away)
  useEffect(() => {
    setSlashMenuBlockId(null);
  }, [selectedBlockId]);

  // Conditional rendering with query states (after all hooks)
  if (blocksQuery.isLoading) {
    return <div className="editor-loading">Loading blocks...</div>;
  }

  if (blocksQuery.error) {
    return <div className="editor-error">Error loading blocks: {(blocksQuery.error as Error).message}</div>;
  }

  return (
    <div className="block-editor">
      <div className="blocks-container">
        {blocks.map((block, index) => (
          <Block
            key={block.id}
            block={block}
            isSelected={selectedBlockId === block.id}
            isSlashMenuOpen={slashMenuBlockId === block.id}
            onSelect={setSelectedBlockId}
            onContentChange={handleContentChange}
            onEnter={handleEnter}
            onBackspace={handleBackspace}
            onSlash={handleSlash}
            onDelete={handleDeleteBlock}
          />
        ))}
      </div>

      {slashMenuBlockId && (
        <SlashMenu
          blockId={slashMenuBlockId}
          position={slashMenuPosition}
          onSelectType={(type) => handleChangeBlockType(slashMenuBlockId, type)}
          onClose={(clearText) => {
            if (clearText && slashMenuBlockId) {
              handleContentChange(slashMenuBlockId, { text: "", html: "" });
            }
            setSlashMenuBlockId(null);
          }}
        />
      )}
    </div>
  );
};
