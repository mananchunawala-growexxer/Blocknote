import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { BlockEditor } from "./BlockEditor";
import type { BlockDto } from "../types/block";

const apiMocks = vi.hoisted(() => ({
  getDocumentBlocks: vi.fn(),
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlock: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderEditor(initialBlocks: BlockDto[]) {
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <BlockEditor documentId="doc-1" initialBlocks={initialBlocks} />
    </QueryClientProvider>,
  );
}

function setCaretPosition(element: HTMLElement, position: number) {
  const textNode = element.firstChild ?? element.appendChild(document.createTextNode(element.textContent ?? ""));
  const range = document.createRange();
  range.setStart(textNode, position);
  range.collapse(true);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

const baseBlock: BlockDto = {
  id: "block-1",
  documentId: "doc-1",
  parentId: null,
  type: "paragraph",
  content: {
    text: "hello",
    html: "hello",
  },
  orderIndex: "1000.0000000000",
  createdAt: "2026-04-16T00:00:00.000Z",
  updatedAt: "2026-04-16T00:00:00.000Z",
};

describe("BlockEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getDocumentBlocks.mockResolvedValue({ blocks: [baseBlock] });
    apiMocks.createBlock.mockResolvedValue({
      block: {
        ...baseBlock,
        id: "block-2",
        content: {
          text: "llo",
          html: "llo",
        },
        orderIndex: "2000.0000000000",
      },
    });
    apiMocks.updateBlock.mockImplementation(async (input: Record<string, unknown>) => ({
      block: {
        ...baseBlock,
        ...(("type" in input && input.type) ? { type: input.type } : {}),
        content: (input.content as Record<string, unknown>) ?? baseBlock.content,
      },
    }));
    apiMocks.deleteBlock.mockResolvedValue(undefined);
    apiMocks.reorderBlock.mockResolvedValue({
      block: {
        ...baseBlock,
      },
    });
  });

  it("splits at the clicked caret position when Enter is pressed mid-word", async () => {
    const { container } = renderEditor([baseBlock]);
    const editable = await waitFor(() => {
      const node = container.querySelector("[data-block-id='block-1'] [contenteditable='true']") as HTMLElement | null;
      expect(node).not.toBeNull();
      return node!;
    });

    editable.focus();
    setCaretPosition(editable, 2);
    fireEvent.click(editable);
    fireEvent.keyDown(editable, { key: "Enter" });

    await waitFor(() => {
      expect(apiMocks.updateBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          blockId: "block-1",
          content: expect.objectContaining({
            text: "he",
            html: "he",
          }),
        }),
      );
    });

    expect(apiMocks.createBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: "doc-1",
        type: "paragraph",
        content: expect.objectContaining({
          text: "llo",
        }),
      }),
    );

    expect(apiMocks.reorderBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: "block-2",
        afterOrderIndex: "1000.0000000000",
      }),
    );
  });

  it("inserts a new paragraph directly below current block at end of line", async () => {
    const secondBlock: BlockDto = {
      ...baseBlock,
      id: "block-3",
      content: { text: "world", html: "world" },
      orderIndex: "2000.0000000000",
    };

    const { container } = renderEditor([baseBlock, secondBlock]);
    const editable = await waitFor(() => {
      const node = container.querySelector("[data-block-id='block-1'] [contenteditable='true']") as HTMLElement | null;
      expect(node).not.toBeNull();
      return node!;
    });

    editable.focus();
    setCaretPosition(editable, 5);
    fireEvent.keyDown(editable, { key: "Enter" });

    await waitFor(() => {
      expect(apiMocks.createBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: "doc-1",
          type: "paragraph",
        }),
      );
    });

    expect(apiMocks.reorderBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: "block-2",
        afterOrderIndex: "1000.0000000000",
        beforeOrderIndex: "2000.0000000000",
      }),
    );
  });

  it("creates a paragraph when Enter is pressed inside a to-do block", async () => {
    const todoBlock: BlockDto = {
      ...baseBlock,
      id: "todo-1",
      type: "todo",
      content: {
        text: "task",
        html: "task",
        checked: false,
      },
    };

    const { container } = renderEditor([todoBlock]);
    const editable = await waitFor(() => {
      const node = container.querySelector("[data-block-id='todo-1'] [contenteditable='true']") as HTMLElement | null;
      expect(node).not.toBeNull();
      return node!;
    });

    editable.focus();
    setCaretPosition(editable, 4);
    fireEvent.keyDown(editable, { key: "Enter" });

    await waitFor(() => {
      expect(apiMocks.createBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: "doc-1",
          type: "paragraph",
        }),
      );
    });
  });

  it("queues the newest autosave while an older save is still in flight", async () => {
    const firstSave = deferred<{ block: BlockDto }>();
    const secondSave = deferred<{ block: BlockDto }>();

    apiMocks.updateBlock
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise);

    const { container } = renderEditor([baseBlock]);
    const editable = await waitFor(() => {
      const node = container.querySelector("[data-block-id='block-1'] [contenteditable='true']") as HTMLElement | null;
      expect(node).not.toBeNull();
      return node!;
    });

    vi.useFakeTimers();

    editable.textContent = "a";
    editable.innerHTML = "a";
    fireEvent.input(editable);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(apiMocks.updateBlock).toHaveBeenCalledTimes(1);
    expect(apiMocks.updateBlock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        blockId: "block-1",
        content: expect.objectContaining({
          text: "a",
        }),
      }),
    );

    editable.textContent = "ab";
    editable.innerHTML = "ab";
    fireEvent.input(editable);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(apiMocks.updateBlock).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve({
        block: {
          ...baseBlock,
          content: {
            text: "a",
            html: "a",
          },
        },
      });
      await firstSave.promise;
      await Promise.resolve();
    });

    expect(apiMocks.updateBlock).toHaveBeenCalledTimes(2);

    expect(apiMocks.updateBlock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        blockId: "block-1",
        content: expect.objectContaining({
          text: "ab",
        }),
      }),
    );

    await act(async () => {
      secondSave.resolve({
        block: {
          ...baseBlock,
          content: {
            text: "ab",
            html: "ab",
          },
        },
      });
      await secondSave.promise;
    });
  });
});
