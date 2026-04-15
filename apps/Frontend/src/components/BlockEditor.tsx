import React, { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlockDto, BlockType } from "../types/block";
import {
  getDocumentBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  reorderBlock,
} from "../lib/api";
import { Block } from "./Block";
import { SlashMenu } from "./SlashMenu";
import {
  splitBlock,
  mergeWithPrevious,
  createNewBlock,
  getBlockText,
  getCursorPosition,
  setCursorPosition,
  isBlockEmpty,
} from "../utils/blockUtils";

interface BlockEditorProps {
  documentId: string;
  initialBlocks?: BlockDto[];
  queryKey?: readonly string[];
  readOnly?: boolean;
  initialSavedAt?: string;
}

const BLOCK_BAR_ITEMS: Array<{ type: BlockType; label: string; icon: string }> = [
  { type: "paragraph", label: "Paragraph", icon: "¶" },
  { type: "heading_1", label: "Heading 1", icon: "H1" },
  { type: "heading_2", label: "Heading 2", icon: "H2" },
  { type: "todo", label: "Todo", icon: "☑" },
  { type: "code", label: "Code", icon: "</>" },
  { type: "divider", label: "Divider", icon: "—" },
  { type: "image", label: "Image", icon: "▣" },
];

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
export const BlockEditor: React.FC<BlockEditorProps> = ({
  documentId,
  initialBlocks,
  queryKey = ["documents", documentId, "blocks"],
  readOnly = false,
  initialSavedAt,
}) => {
  const queryClient = useQueryClient();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [slashMenuBlockId, setSlashMenuBlockId] = useState<string | null>(null);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 140, left: 140 });
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [isDeleteZoneHovered, setIsDeleteZoneHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [historyPast, setHistoryPast] = useState<BlockDto[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<BlockDto[][]>([]);
  const [historyCurrent, setHistoryCurrent] = useState<BlockDto[]>([]);
  const [isRestoringHistory, setIsRestoringHistory] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialSavedAt ?? null);
  const [emptyStateMessage, setEmptyStateMessage] = useState<string | null>(null);

  // Fetch blocks for document
  const blocksQuery = useQuery({
    queryKey,
    queryFn: () => getDocumentBlocks(documentId),
    initialData: initialBlocks ? { blocks: initialBlocks } : undefined,
    enabled: !readOnly,
  });

  const blocks = (readOnly ? initialBlocks : blocksQuery.data?.blocks) ?? [];

  const markSaving = useCallback(() => {
    if (!readOnly) {
      setAutosaveState("saving");
    }
  }, [readOnly]);

  const markSaved = useCallback(() => {
    if (!readOnly) {
      setAutosaveState("saved");
      setLastSavedAt(new Date().toISOString());
    }
  }, [readOnly]);

  const documentText = blocks
    .map((block) => {
      if (block.type === "divider") return "";
      return typeof block.content.text === "string" ? block.content.text : "";
    })
    .join(" ")
    .trim();
  const wordCount = documentText.length > 0 ? documentText.split(/\s+/).length : 0;
  const characterCount = documentText.replace(/\s/g, "").length;

  // Mutations for block operations
  const createBlockMutation = useMutation({
    mutationFn: (data: {
      documentId: string;
      type: BlockType;
      content?: Record<string, unknown>;
    }) => createBlock(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      markSaved();
    },
    onError: () => setAutosaveState("idle"),
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
      queryClient.invalidateQueries({ queryKey });
      markSaved();
    },
    onError: () => setAutosaveState("idle"),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (blockId: string) => deleteBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      markSaved();
    },
    onError: () => setAutosaveState("idle"),
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
      const block = blocks.find((b: BlockDto) => b.id === blockId);
      if (!block) return;

      const text = (block.content.text as string) ?? "";
      const html = (block.content.html as string) ?? "";

      if (block.type === "todo") {
        const beforeCursor = text.slice(0, cursorPosition);
        const afterCursor = text.slice(cursorPosition);

        // Common to-do behavior: pressing Enter on an empty to-do exits checklist mode.
        if (text.trim().length === 0) {
          await updateBlockMutation.mutateAsync({
            blockId: block.id,
            type: "paragraph",
            content: { text: "", html: "" },
          });
          setSelectedBlockId(block.id);
          return;
        }

        if (cursorPosition < text.length) {
          await updateBlockMutation.mutateAsync({
            blockId: block.id,
            content: {
              ...block.content,
              text: beforeCursor,
              html: beforeCursor,
            },
          });
        }

        const response = await createBlockMutation.mutateAsync({
          documentId,
          type: "todo",
          content: {
            text: afterCursor,
            html: afterCursor,
            checked: false,
          },
        });

        const newBlockId = response.block.id;
        setEmptyStateMessage(null);
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
        setEmptyStateMessage(null);
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
        content: {
          ...updatedBlock.content,
          html,
        },
      });

      // Create new block with text after cursor
      const response = await createBlockMutation.mutateAsync({
        documentId,
        type: "paragraph",
        content: newBlock.content,
      });

      // Move focus to the new block
      const newBlockId = response.block.id;
      setEmptyStateMessage(null);
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
      const blockIndex = blocks.findIndex((b: BlockDto) => b.id === blockId);
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
      const block = blocks.find((b: BlockDto) => b.id === blockId);
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

          queryClient.setQueryData(queryKey, (old: any) =>
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
          markSaving();
          return;
        }
      }

      // Update local state immediately for responsiveness
      queryClient.setQueryData(
        queryKey,
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
        markSaving();
        updateBlockMutation.mutate({
          blockId,
          content: mergedContent,
        });
      }, 500);

      return () => clearTimeout(timeout);
    },
    [blocks, documentId, getAutoTransform, markSaving, queryClient, queryKey, updateBlockMutation],
  );

  /**
   * Handle slash command menu
   * Opens menu for block type selection
   */
  const handleSlash = useCallback((blockId: string) => {
    const menuWidth = Math.min(520, window.innerWidth - 28);
    const menuHeight = Math.min(320, window.innerHeight - 28);
    const minPadding = 12;

    let top = minPadding;
    let left = minPadding;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rangeRect = range.getClientRects()[0] ?? range.getBoundingClientRect();

      if (rangeRect && (rangeRect.width > 0 || rangeRect.height > 0 || rangeRect.top > 0 || rangeRect.left > 0)) {
        top = Math.max(
          minPadding,
          Math.min(window.innerHeight - menuHeight - minPadding, rangeRect.bottom + 10),
        );
        left = Math.max(
          minPadding,
          Math.min(window.innerWidth - menuWidth - minPadding, rangeRect.left - 18),
        );
      }
    }

    // Fallback if selection rect is unavailable.
    if (top === minPadding && left === minPadding) {
      const blockElement = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
      if (blockElement) {
        const rect = blockElement.getBoundingClientRect();
        top = Math.max(minPadding, Math.min(window.innerHeight - menuHeight - minPadding, rect.bottom + 8));
        left = Math.max(minPadding, Math.min(window.innerWidth - menuWidth - minPadding, rect.left + 8));
      }
    }

    setSlashMenuPosition({ top, left });

    setSelectedBlockId(blockId);
    setSlashMenuBlockId(blockId);
  }, []);

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      const blockIndex = blocks.findIndex((b: BlockDto) => b.id === blockId);
      if (blockIndex === -1) return;

      if (blocks.length === 1) {
        markSaving();
        await deleteBlockMutation.mutateAsync(blockId);
        setSelectedBlockId(null);
        setEmptyStateMessage("Everything is cleared. Start a fresh block whenever inspiration hits.");
        return;
      }

      const nextFocusBlock = blocks[blockIndex + 1] ?? blocks[blockIndex - 1] ?? null;
      markSaving();
      await deleteBlockMutation.mutateAsync(blockId);
      if (nextFocusBlock) {
        setSelectedBlockId(nextFocusBlock.id);
      }
      setEmptyStateMessage(null);
    },
    [blocks, deleteBlockMutation, markSaving],
  );

  const handleToggleMultiSelect = useCallback((blockId: string) => {
    setSelectedBlockIds((current) =>
      current.includes(blockId) ? current.filter((id) => id !== blockId) : [...current, blockId],
    );
  }, []);

  const handleDuplicateBlock = useCallback(
    async (blockId: string) => {
      const block = blocks.find((item) => item.id === blockId);
      if (!block) return;

      markSaving();
      const response = await createBlockMutation.mutateAsync({
        documentId,
        type: block.type as BlockType,
        content: { ...block.content },
      });

      setEmptyStateMessage(null);
      setSelectedBlockId(response.block.id);
    },
    [blocks, createBlockMutation, documentId, markSaving],
  );

  const handleCreateFirstBlock = useCallback(async () => {
    markSaving();
    const response = await createBlockMutation.mutateAsync({
      documentId,
      type: "paragraph",
      content: { text: "", html: "" },
    });
    setEmptyStateMessage(null);
    setSelectedBlockId(response.block.id);
  }, [createBlockMutation, documentId, markSaving]);

  const focusBlockByIndex = useCallback(
    (targetIndex: number, desiredPosition: number) => {
      const targetBlock = blocks[targetIndex];
      if (!targetBlock) return;

      setSelectedBlockId(targetBlock.id);
      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${targetBlock.id}"]`) as HTMLElement | null;
        const editable = blockElement?.querySelector("[contenteditable='true']") as HTMLElement | null;
        const input = blockElement?.querySelector("input[type='text']") as HTMLInputElement | null;

        if (editable) {
          editable.focus();
          const nextPosition = Math.max(0, Math.min(desiredPosition, getBlockText(editable).length));
          setCursorPosition(editable, nextPosition);
          return;
        }

        if (input) {
          input.focus();
          const nextPosition = Math.max(0, Math.min(desiredPosition, input.value.length));
          input.setSelectionRange(nextPosition, nextPosition);
        }
      }, 30);
    },
    [blocks],
  );

  const handleVerticalNavigate = useCallback(
    (blockId: string, direction: "up" | "down", cursorPosition: number) => {
      const blockIndex = blocks.findIndex((block) => block.id === blockId);
      if (blockIndex === -1) return;

      const nextIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;
      if (nextIndex < 0 || nextIndex >= blocks.length) return;

      focusBlockByIndex(nextIndex, cursorPosition);
    },
    [blocks, focusBlockByIndex],
  );

  const applySnapshot = useCallback(
    async (snapshot: BlockDto[]) => {
      const currentBlocks = [...blocks];

      if (snapshot.length === 0) {
        if (currentBlocks.length === 0) return;

        const [anchor, ...rest] = currentBlocks;
        if (!anchor) return;

        await deleteBlockMutation.mutateAsync(anchor.id);
        for (const block of rest) {
          await deleteBlockMutation.mutateAsync(block.id);
        }
        setSelectedBlockId(null);
        setEmptyStateMessage("Everything is cleared. Start a fresh block whenever inspiration hits.");
        return;
      }

      if (currentBlocks.length === 0) {
        for (const block of snapshot) {
          const created = await createBlockMutation.mutateAsync({
            documentId,
            type: block.type as BlockType,
            content: { ...block.content },
          });
          setSelectedBlockId(created.block.id);
        }
        return;
      }

      const [anchor, ...restCurrent] = currentBlocks;
      if (!anchor) return;

      const [firstSnapshot, ...restSnapshot] = snapshot;
      if (!firstSnapshot) return;

      await updateBlockMutation.mutateAsync({
        blockId: anchor.id,
        type: firstSnapshot.type as BlockType,
        content: { ...firstSnapshot.content },
      });

      for (const block of restCurrent) {
        await deleteBlockMutation.mutateAsync(block.id);
      }

      for (const block of restSnapshot) {
        await createBlockMutation.mutateAsync({
          documentId,
          type: block.type as BlockType,
          content: { ...block.content },
        });
      }

      setSelectedBlockId(anchor.id);
      setEmptyStateMessage(null);
    },
    [blocks, createBlockMutation, deleteBlockMutation, documentId, updateBlockMutation],
  );

  const handleHistoryRestore = useCallback(
    async (direction: "undo" | "redo") => {
      if (isRestoringHistory) return;

      const targetStack = direction === "undo" ? historyPast : historyFuture;
      if (targetStack.length === 0) return;

      const nextSnapshot = targetStack[targetStack.length - 1];
      const currentSnapshot = historyCurrent;

      setIsRestoringHistory(true);

      if (direction === "undo") {
        setHistoryPast((current) => current.slice(0, -1));
        setHistoryFuture((current) => [...current, currentSnapshot]);
      } else {
        setHistoryFuture((current) => current.slice(0, -1));
        setHistoryPast((current) => [...current, currentSnapshot]);
      }
      setHistoryCurrent(nextSnapshot);

      try {
        await applySnapshot(nextSnapshot);
      } finally {
        setIsRestoringHistory(false);
      }
    },
    [applySnapshot, historyCurrent, historyFuture, historyPast, isRestoringHistory],
  );

  const handleClearMultiSelect = useCallback(() => {
    setSelectedBlockIds([]);
  }, []);

  const handleDeleteSelectedBlocks = useCallback(async () => {
    if (selectedBlockIds.length === 0) return;

    const selectedBlocks = blocks.filter((block) => selectedBlockIds.includes(block.id));
    if (selectedBlocks.length === 0) {
      setSelectedBlockIds([]);
      return;
    }

    if (selectedBlocks.length === blocks.length) {
      markSaving();
      for (const block of selectedBlocks) {
        await deleteBlockMutation.mutateAsync(block.id);
      }
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
      setEmptyStateMessage("Everything is cleared. Start a fresh block whenever inspiration hits.");
      return;
    }

    const survivingBlock =
      blocks.find((block) => !selectedBlockIds.includes(block.id)) ??
      blocks.find((block) => block.id !== selectedBlocks[0]?.id) ??
      null;

    markSaving();
    for (const block of selectedBlocks) {
      await deleteBlockMutation.mutateAsync(block.id);
    }

    if (survivingBlock) {
      setSelectedBlockId(survivingBlock.id);
    }
    setSelectedBlockIds([]);
    setEmptyStateMessage(null);
  }, [blocks, deleteBlockMutation, markSaving, selectedBlockIds]);

  const handleAddBlockAfter = useCallback(
    async (blockId: string) => {
      const blockIndex = blocks.findIndex((b: BlockDto) => b.id === blockId);
      if (blockIndex === -1) return;

      const currentBlock = blocks[blockIndex];
      const nextBlock = blocks[blockIndex + 1] ?? null;
      if (!currentBlock) return;

      markSaving();
      const response = await createBlockMutation.mutateAsync({
        documentId,
        type: "paragraph",
        content: {
          text: "",
          html: "",
        },
      });

      const newBlockId = response.block.id;
      await reorderBlock({
        blockId: newBlockId,
        afterOrderIndex: currentBlock.orderIndex,
        beforeOrderIndex: nextBlock?.orderIndex,
      });
      await queryClient.invalidateQueries({ queryKey });
      setEmptyStateMessage(null);
      setSelectedBlockId(newBlockId);

      setTimeout(() => {
        const blockElement = document.querySelector(`[data-block-id="${newBlockId}"]`) as HTMLElement | null;
        const editable = blockElement?.querySelector("[contenteditable='true']") as HTMLElement | null;
        if (editable) {
          editable.focus();
          setCursorPosition(editable, 0);
        }
      }, 100);
    },
    [blocks, createBlockMutation, documentId, markSaving, queryClient, queryKey],
  );

  const handleBlockDragStart = useCallback(
    (blockId: string, event: React.DragEvent<HTMLElement>) => {
      setDraggedBlockId(blockId);
      setIsDragging(true);
      setSelectedBlockId(blockId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", blockId);

      const blockElement = (event.currentTarget as HTMLElement).closest("[data-block-id]") as HTMLElement | null;
      if (blockElement) {
        const blockRect = blockElement.getBoundingClientRect();
        const preview = blockElement.cloneNode(true) as HTMLElement;
        preview.classList.add("block-drag-preview");
        preview.style.width = `${blockRect.width}px`;
        preview.style.left = "-9999px";
        preview.style.top = "-9999px";
        document.body.appendChild(preview);
        event.dataTransfer.setDragImage(preview, Math.min(40, blockRect.width / 2), 20);
        requestAnimationFrame(() => {
          preview.remove();
        });
      }
    },
    [],
  );

  const handleBlockDragEnd = useCallback(() => {
    setDraggedBlockId(null);
    setIsDragging(false);
    setIsDeleteZoneHovered(false);
  }, []);

  const handleDeleteZoneDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const droppedBlockId = event.dataTransfer.getData("text/plain") || draggedBlockId;
      setIsDeleteZoneHovered(false);

      if (!droppedBlockId) {
        setDraggedBlockId(null);
        setIsDragging(false);
        return;
      }

      await handleDeleteBlock(droppedBlockId);
      setDraggedBlockId(null);
      setIsDragging(false);
    },
    [draggedBlockId, handleDeleteBlock],
  );

  /**
   * Handle block type change from slash menu
   */
  const handleChangeBlockType = useCallback(
    async (blockId: string, newType: BlockType) => {
      const block = blocks.find((b: BlockDto) => b.id === blockId);
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
      markSaving();
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
    [blocks, markSaving, updateBlockMutation],
  );

  const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null;

  // Set first block as selected by default (MUST be before any early returns)
  useEffect(() => {
    if (blocks.length > 0 && !selectedBlockId) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  useEffect(() => {
    setSelectedBlockIds((current) => current.filter((id) => blocks.some((block) => block.id === id)));
  }, [blocks]);

  useEffect(() => {
    if (readOnly) return;

    if (historyCurrent.length === 0 && blocks.length > 0) {
      setHistoryCurrent(blocks);
      return;
    }

    if (isRestoringHistory) return;

    const currentSerialized = JSON.stringify(historyCurrent);
    const nextSerialized = JSON.stringify(blocks);

    if (currentSerialized !== nextSerialized) {
      setHistoryPast((current) => [...current.slice(-49), historyCurrent]);
      setHistoryCurrent(blocks);
      setHistoryFuture([]);
    }
  }, [blocks, historyCurrent, isRestoringHistory, readOnly]);

  useEffect(() => {
    if (readOnly) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      if (!event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void handleHistoryRestore("undo");
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void handleHistoryRestore("redo");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleHistoryRestore, readOnly]);

  // Close slash menu if selection changes (e.g. clicking away)
  useEffect(() => {
    setSlashMenuBlockId(null);
  }, [selectedBlockId]);

  // Conditional rendering with query states (after all hooks)
  if (!readOnly && blocksQuery.isLoading) {
    return (
      <div className="editor-skeleton-list" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="editor-skeleton-block">
            <div className="editor-skeleton-line long" />
            <div className="editor-skeleton-line medium" />
            <div className="editor-skeleton-line short" />
          </div>
        ))}
      </div>
    );
  }

  if (!readOnly && blocksQuery.error) {
    return <div className="editor-error">Error loading blocks: {(blocksQuery.error as Error).message}</div>;
  }

  return (
    <div className={`block-editor ${isDragging ? "is-block-dragging" : ""}`}>
      {readOnly ? (
        <div className="read-only-banner">Shared mode is read only. You can view the full document but cannot edit it.</div>
      ) : (
        <div className="block-command-bar" role="toolbar" aria-label="Block command bar">
          {BLOCK_BAR_ITEMS.map((item) => (
            <button
              key={item.type}
              type="button"
              className={`block-command-btn ${selectedBlock?.type === item.type ? "active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const targetBlockId = selectedBlockId ?? blocks[0]?.id;
                if (!targetBlockId) return;
                void handleChangeBlockType(targetBlockId, item.type);
              }}
            >
              <span className="block-command-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {blocks.length === 0 ? (
        <div className="editor-empty-state">
          <div className="editor-empty-illustration" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h3>Ready for a fresh start?</h3>
          <p>{emptyStateMessage ?? (readOnly ? "This document has no visible blocks yet." : "You can add a new block and keep writing whenever you're ready.")}</p>
          {!readOnly ? (
            <button type="button" className="empty-state-action" onClick={() => void handleCreateFirstBlock()}>
              Add a new block
            </button>
          ) : null}
        </div>
      ) : (
      <div className="blocks-container">
        {blocks.map((block: BlockDto) => (
          <Block
            key={block.id}
            block={block}
            isSelected={selectedBlockId === block.id}
            isBeingDragged={draggedBlockId === block.id}
            isMultiSelected={selectedBlockIds.includes(block.id)}
            isSlashMenuOpen={slashMenuBlockId === block.id}
            onSelect={setSelectedBlockId}
            onToggleMultiSelect={handleToggleMultiSelect}
            onContentChange={handleContentChange}
            onEnter={handleEnter}
            onBackspace={handleBackspace}
            onVerticalNavigate={handleVerticalNavigate}
            onDuplicate={handleDuplicateBlock}
            onSlash={handleSlash}
            onAddAfter={handleAddBlockAfter}
            onDragStart={handleBlockDragStart}
            onDragEnd={handleBlockDragEnd}
            readOnly={readOnly}
          />
        ))}
      </div>
      )}

      <div className="editor-status-bar">
        <span>
          {autosaveState === "saving"
            ? "Autosaving..."
            : lastSavedAt
              ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
              : "Not saved yet"}
        </span>
        <span>{wordCount} words</span>
        <span>{characterCount} characters</span>
        {!readOnly ? <span>Ctrl/Cmd+Z undo</span> : null}
      </div>

      {!readOnly ? (
        <>
          {selectedBlockIds.length > 0 ? (
            <div className="multi-select-bar" role="toolbar" aria-label="Selected blocks actions">
              <span className="multi-select-count">
                {selectedBlockIds.length} selected
              </span>
              <button
                type="button"
                className="multi-select-action danger"
                onClick={() => {
                  void handleDeleteSelectedBlocks();
                }}
              >
                Delete all
              </button>
              <button
                type="button"
                className="multi-select-action"
                onClick={handleClearMultiSelect}
              >
                Cancel
              </button>
            </div>
          ) : null}

        <div
          className={`block-delete-zone ${draggedBlockId ? "active" : ""} ${isDeleteZoneHovered ? "hovered" : ""} ${isDragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            if (!draggedBlockId) return;
            event.preventDefault();
            setIsDeleteZoneHovered(true);
          }}
          onDragEnter={(event) => {
            if (!draggedBlockId) return;
            event.preventDefault();
            setIsDeleteZoneHovered(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            setIsDeleteZoneHovered(false);
          }}
          onDrop={(event) => {
            void handleDeleteZoneDrop(event);
          }}
        >
          <span className="block-delete-zone-icon" aria-hidden="true">
            🗑
          </span>
          <span className="block-delete-zone-copy">
            <span className="block-delete-zone-title">Drop here to delete</span>
            <span className="block-delete-zone-hint">Drag a block into the dustbin to remove it</span>
          </span>
        </div>
        </>
      ) : null}

      {!readOnly && slashMenuBlockId && (
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
