import React, { useRef, useEffect, useState } from "react";
import type { BlockDto } from "@blocknote/shared";
import {
  getCursorPosition,
  setCursorPosition,
  getBlockText,
} from "../utils/blockUtils";

interface BlockProps {
  block: BlockDto;
  isSelected: boolean;
  isSlashMenuOpen?: boolean;
  onSelect: (blockId: string) => void;
  onContentChange: (blockId: string, contentPatch: Record<string, unknown>) => void;
  onEnter: (blockId: string, cursorPosition: number) => void;
  onBackspace: (blockId: string, cursorPosition: number) => void;
  onTab?: (blockId: string, shiftKey: boolean) => void;
  onSlash: (blockId: string) => void;
  onDelete: (blockId: string) => void;
}

/**
 * Block component renders a single block with contentEditable
 * Handles keyboard events (Enter, Backspace, Tab, Slash)
 * Manages focus and cursor position
 */
export const Block: React.FC<BlockProps> = ({
  block,
  isSelected,
  isSlashMenuOpen = false,
  onSelect,
  onContentChange,
  onEnter,
  onBackspace,
  onTab,
  onSlash,
  onDelete,
}) => {
  const contentRef = useRef<any>(null);
  const [savedCursorPos, setSavedCursorPos] = useState(0);
  const [toolbarState, setToolbarState] = useState<{
    visible: boolean;
    top: number;
    left: number;
  }>({ visible: false, top: 0, left: 0 });

  // Restore cursor position when block becomes selected
  useEffect(() => {
    if (isSelected && contentRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        setCursorPosition(contentRef.current, savedCursorPos);
        contentRef.current?.focus();
      }, 0);
    }
  }, [isSelected, savedCursorPos, block.type]);

  // Sync content from block to DOM on mount or content change
  useEffect(() => {
    if (contentRef.current) {
      const html = (block.content.html as string | undefined) ?? null;
      const text = (block.content.text as string) ?? "";

      if (html !== null) {
        if (contentRef.current.innerHTML !== html) {
          contentRef.current.innerHTML = html;
        }
      } else if (contentRef.current.textContent !== text) {
        contentRef.current.textContent = text;
      }
    }
  }, [block.id, block.content]);

  const syncContentFromDom = () => {
    if (!contentRef.current) return;

    onContentChange(block.id, {
      text: getBlockText(contentRef.current),
      html: contentRef.current.innerHTML,
    });
  };

  const getEditorSelectionRange = (): { selection: Selection; range: Range } | null => {
    if (!contentRef.current) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) return null;

    return { selection, range };
  };

  const replaceRangeWithNode = (selection: Selection, range: Range, node: Node) => {
    range.deleteContents();
    range.insertNode(node);

    const after = document.createRange();
    after.setStartAfter(node);
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);
  };

  const wrapSelectionInTag = (tagName: "strong" | "em" | "code", placeholder: string) => {
    if (!contentRef.current) return;

    const selectionInfo = getEditorSelectionRange();
    if (!selectionInfo) return;
    const { selection, range } = selectionInfo;

    const wrapper = document.createElement(tagName);

    if (range.collapsed) {
      wrapper.textContent = placeholder;
      replaceRangeWithNode(selection, range, wrapper);
    } else {
      const selectedFragment = range.extractContents();
      wrapper.appendChild(selectedFragment);
      range.insertNode(wrapper);

      const after = document.createRange();
      after.setStartAfter(wrapper);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    }

    contentRef.current.focus();
    syncContentFromDom();
  };

  const applyLinkFormat = () => {
    if (!contentRef.current) return;

    const url = window.prompt("Enter URL");
    if (!url) return;

    const selectionInfo = getEditorSelectionRange();
    if (!selectionInfo) return;
    const { selection, range } = selectionInfo;

    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const link = document.createElement("a");
    link.href = normalizedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    if (range.collapsed) {
      link.textContent = normalizedUrl;
      replaceRangeWithNode(selection, range, link);
    } else {
      const selectedFragment = range.extractContents();
      link.appendChild(selectedFragment);
      range.insertNode(link);

      const after = document.createRange();
      after.setStartAfter(link);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    }

    contentRef.current.focus();
    syncContentFromDom();
  };

  useEffect(() => {
    const supportsInlineToolbar = block.type !== "divider" && block.type !== "image";
    if (!supportsInlineToolbar) {
      setToolbarState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const handleSelectionChange = () => {
      if (!isSelected || isSlashMenuOpen || !contentRef.current) {
        setToolbarState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setToolbarState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const range = selection.getRangeAt(0);
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
        setToolbarState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setToolbarState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      setToolbarState({
        visible: true,
        top: Math.max(8, rect.top - 44),
        left: Math.max(8, rect.left + rect.width / 2 - 120),
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [block.type, isSelected, isSlashMenuOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentPosition = getCursorPosition(contentRef.current);

    if (isSlashMenuOpen) {
      // Keep focus in this block while slash menu handles keyboard actions.
      e.preventDefault();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      wrapSelectionInTag("strong", "bold");
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "i") {
      e.preventDefault();
      wrapSelectionInTag("em", "italic");
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      wrapSelectionInTag("code", "code");
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      applyLinkFormat();
      return;
    }

    // Enter key: split block
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter(block.id, currentPosition);
      return;
    }

    // Backspace: merge with previous block
    if (e.key === "Backspace") {
      if (currentPosition === 0) {
        e.preventDefault();
        onBackspace(block.id, currentPosition);
      }
      return;
    }

    // Tab: indent/outdent (if handler provided)
    if (e.key === "Tab") {
      if (onTab) {
        e.preventDefault();
        onTab(block.id, e.shiftKey);
      }
      return;
    }

    // Slash: open command menu (only if at start of empty or near-empty text)
    if (e.key === "/" && currentPosition === 0) {
      const text = getBlockText(contentRef.current);
      // Allow slash menu if block is empty or nearly empty
      if (text.length === 0 || text === "/") {
        e.preventDefault();
        onSlash(block.id);
      }
      return;
    }
  };

  const handleInput = () => {
    if (!contentRef.current) return;
    onContentChange(block.id, {
      text: getBlockText(contentRef.current),
      html: contentRef.current.innerHTML,
    });
  };

  const handleBlur = () => {
    // Save cursor position before losing focus
    const position = getCursorPosition(contentRef.current);
    setSavedCursorPos(position);
  };

  const handleClick = () => {
    onSelect(block.id);
  };

  // Render block based on type
  const renderBlock = () => {
    const commonProps = {
      onKeyDown: handleKeyDown,
      onInput: handleInput,
      onBlur: handleBlur,
      onClick: handleClick,
    };

    switch (block.type) {
      case "heading_1":
        return (
          <h1
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            className="block-content heading-1"
            data-placeholder="Heading 1"
            {...commonProps}
          />
        );

      case "heading_2":
        return (
          <h2
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            className="block-content heading-2"
            data-placeholder="Heading 2"
            {...commonProps}
          />
        );

      case "code":
        return (
          <pre
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            className="block-content code"
            spellCheck="false"
            data-placeholder="Write code..."
            onKeyDown={(e) => {
              // Handle Tab in code blocks
              if (e.key === "Tab") {
                e.preventDefault();
                const position = getCursorPosition(contentRef.current);
                const text = getBlockText(contentRef.current);
                const newText = text.slice(0, position) + "  " + text.slice(position);
                if (contentRef.current) {
                  contentRef.current.textContent = newText;
                }
                onContentChange(block.id, {
                  text: newText,
                  html: contentRef.current?.innerHTML ?? newText,
                });
                // Restore cursor after the 2 spaces we inserted
                setCursorPosition(contentRef.current, position + 2);
              } else {
                handleKeyDown(e as any);
              }
            }}
            onInput={handleInput}
            onBlur={handleBlur}
            onClick={handleClick}
          />
        );

      case "divider":
        return <hr className="block-content divider" />;

      case "image":
        return (
          <div className="block-content image-block">
            <input
              type="text"
              placeholder="Enter image URL..."
              value={(block.content.url as string) ?? ""}
              onChange={(e) => {
                onContentChange(block.id, { url: e.target.value });
              }}
              onClick={handleClick}
            />
            {(block.content.url as string) && (
              <img src={block.content.url as string} alt="Block image" className="block-image" />
            )}
          </div>
        );

      case "todo":
        return (
          <div className="block-content todo" onClick={handleClick}>
            <input
              type="checkbox"
              checked={(block.content.checked as boolean) ?? false}
              onChange={(e) => {
                onContentChange(block.id, { checked: e.target.checked });
              }}
              className="todo-checkbox"
            />
            <div
              ref={contentRef}
              contentEditable
              suppressContentEditableWarning
              className="todo-text"
              data-placeholder="To-do"
              {...commonProps}
            />
          </div>
        );

      case "paragraph":
      default:
        return (
          <p
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            className="block-content paragraph"
            data-placeholder="Type '/' for commands"
            {...commonProps}
          />
        );
    }
  };

  return (
    <div className={`block ${block.type} ${isSelected ? "selected" : ""}`} data-block-id={block.id}>
      <div className="block-controls">
        <button
          type="button"
          className="block-control-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSlash(block.id)}
          title="Open slash commands"
        >
          +
        </button>
        <button
          type="button"
          className="block-control-btn block-control-btn-danger"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onDelete(block.id)}
          title="Delete block"
        >
          Del
        </button>
      </div>
      <div className="block-main">{renderBlock()}</div>

      {toolbarState.visible && (
        <div
          className="inline-toolbar"
          style={{ top: toolbarState.top, left: toolbarState.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" onClick={() => wrapSelectionInTag("strong", "bold")} title="Bold (Ctrl/Cmd+B)">
            B
          </button>
          <button type="button" onClick={() => wrapSelectionInTag("em", "italic")} title="Italic (Ctrl/Cmd+I)">
            I
          </button>
          <button type="button" onClick={() => wrapSelectionInTag("code", "code")} title="Code (Ctrl/Cmd+E)">
            {"</>"}
          </button>
          <button type="button" onClick={applyLinkFormat} title="Link (Ctrl/Cmd+K)">
            Link
          </button>
        </div>
      )}
    </div>
  );
};
