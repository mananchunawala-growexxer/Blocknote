import React, { useRef, useEffect, useState } from "react";
import type { BlockDto } from "../types/block";
import {
  getCursorPosition,
  setCursorPosition,
  getBlockText,
} from "../utils/blockUtils";

const CODE_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
] as const;

interface BlockProps {
  block: BlockDto;
  isSelected: boolean;
  isBeingDragged?: boolean;
  isMultiSelected?: boolean;
  readOnly?: boolean;
  isSlashMenuOpen?: boolean;
  onSelect: (blockId: string) => void;
  onToggleMultiSelect?: (blockId: string) => void;
  onContentChange: (blockId: string, contentPatch: Record<string, unknown>) => void;
  onEnter: (blockId: string, cursorPosition: number) => void;
  onBackspace: (blockId: string, cursorPosition: number) => void;
  onVerticalNavigate?: (blockId: string, direction: "up" | "down", cursorPosition: number) => void;
  onDuplicate?: (blockId: string) => void;
  onTab?: (blockId: string, shiftKey: boolean) => void;
  onSlash: (blockId: string, caretPosition?: { top: number; left: number; bottom: number }) => void;
  onAddAfter?: (blockId: string) => void;
  onDragStart?: (blockId: string, event: React.DragEvent<HTMLElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLElement>) => void;
  onDragOver?: (blockId: string, event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (blockId: string, event: React.DragEvent<HTMLDivElement>) => void;
  dragOverPosition?: "before" | "after" | null;
}

/**
 * Block component renders a single block with contentEditable
 * Handles keyboard events (Enter, Backspace, Tab, Slash)
 * Manages focus and cursor position
 */
export const Block: React.FC<BlockProps> = ({
  block,
  isSelected,
  isBeingDragged = false,
  isMultiSelected = false,
  readOnly = false,
  isSlashMenuOpen = false,
  onSelect,
  onToggleMultiSelect,
  onContentChange,
  onEnter,
  onBackspace,
  onVerticalNavigate,
  onDuplicate,
  onTab,
  onSlash,
  onAddAfter,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  dragOverPosition = null,
}) => {
  const contentRef = useRef<any>(null);
  const [savedCursorPos, setSavedCursorPos] = useState(0);
  const [toolbarState, setToolbarState] = useState<{
    visible: boolean;
    top: number;
    left: number;
  }>({ visible: false, top: 0, left: 0 });
  const [showImageUrlInput, setShowImageUrlInput] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const copyResetTimer = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const getSelectionInsideEditable = () => {
    if (!contentRef.current) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) return null;

    return { selection, range };
  };

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isActionMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isActionMenuOpen]);

  // Restore cursor position when block becomes selected
  useEffect(() => {
    if (isSelected && contentRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const editable = contentRef.current as HTMLElement | null;
        if (!editable) return;

        const selectionInfo = getSelectionInsideEditable();
        if (selectionInfo && document.activeElement === editable) {
          setSavedCursorPos(getCursorPosition(editable));
          return;
        }

        editable.focus();
        const nextPosition = Math.max(0, Math.min(savedCursorPos, getBlockText(editable).length));
        setCursorPosition(editable, nextPosition);
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

  useEffect(() => {
    if (block.type !== "image") {
      setShowImageUrlInput(false);
      setImageLoadError(null);
      return;
    }

    const url = ((block.content.url as string) ?? "").trim();
    if (!url) {
      setShowImageUrlInput(true);
      setImageLoadError(null);
    }
  }, [block.id, block.type, block.content.url]);

  const isValidImageUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleCopyCode = async () => {
    const codeText = ((block.content.text as string) ?? "").trim();
    if (!codeText) return;

    try {
      await navigator.clipboard.writeText(codeText);
      setCodeCopied(true);
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
      }
      copyResetTimer.current = window.setTimeout(() => {
        setCodeCopied(false);
      }, 1500);
    } catch {
      // no-op: clipboard access can fail in restricted contexts
    }
  };

  const syncContentFromDom = () => {
    if (readOnly || !contentRef.current) return;

    onContentChange(block.id, {
      text: getBlockText(contentRef.current),
      html: contentRef.current.innerHTML,
    });
  };

  const getEditorSelectionRange = (): { selection: Selection; range: Range } | null => {
    return getSelectionInsideEditable();
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

  const wrapSelectionInTag = (tagName: "strong" | "em" | "u" | "s" | "code", placeholder: string) => {
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
    if (readOnly) {
      return;
    }

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

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "u") {
      e.preventDefault();
      wrapSelectionInTag("u", "underline");
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "x") {
      e.preventDefault();
      wrapSelectionInTag("s", "strike");
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

    if (e.key === "ArrowUp" && currentPosition === 0) {
      e.preventDefault();
      onVerticalNavigate?.(block.id, "up", currentPosition);
      return;
    }

    if (e.key === "ArrowDown") {
      const text = getBlockText(contentRef.current);
      if (currentPosition >= text.length) {
        e.preventDefault();
        onVerticalNavigate?.(block.id, "down", currentPosition);
        return;
      }
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
        const selection = window.getSelection();
        let caretPosition: { top: number; left: number; bottom: number } | undefined;
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0).cloneRange();
          range.collapse(true);
          const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
          if (rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0)) {
            caretPosition = {
              top: rect.top,
              left: rect.left,
              bottom: rect.bottom,
            };
          }
        }
        if (!caretPosition && contentRef.current) {
          const editableRect = (contentRef.current as HTMLElement).getBoundingClientRect();
          const computedStyle = window.getComputedStyle(contentRef.current as HTMLElement);
          const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
          const lineHeight = Number.isFinite(parsedLineHeight)
            ? parsedLineHeight
            : Number.parseFloat(computedStyle.fontSize) * 1.4;
          const lineBottom = editableRect.top + lineHeight;
          caretPosition = {
            top: editableRect.top,
            left: editableRect.left + 6,
            bottom: Math.min(lineBottom, editableRect.bottom),
          };
        }
        onSlash(block.id, caretPosition);
      }
      return;
    }
  };

  const handleInput = () => {
    if (readOnly || !contentRef.current) return;
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
    if (readOnly || !contentRef.current) return;

    const editable = contentRef.current as HTMLElement;
    requestAnimationFrame(() => {
      const currentPosition = getCursorPosition(editable);
      if (currentPosition >= 0) {
        setSavedCursorPos(currentPosition);
        return;
      }

      if (document.activeElement !== editable) {
        editable.focus();
      }

      const fallbackPosition = Math.max(0, Math.min(savedCursorPos, getBlockText(editable).length));
      setCursorPosition(editable, fallbackPosition);
    });
  };

  const handleAddBlock = () => {
    if (readOnly) return;
    onSelect(block.id);
    onAddAfter?.(block.id);
  };

  const handleBlockDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    if (readOnly) return;
    onSelect(block.id);
    onDragStart?.(block.id, event);
  };

  const handleBlockDragEnd = (event: React.DragEvent<HTMLButtonElement>) => {
    onDragEnd?.(event);
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
            contentEditable={!readOnly}
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
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className="block-content heading-2"
            data-placeholder="Heading 2"
            {...commonProps}
          />
        );

      case "code": {
        const selectedLanguage = typeof block.content.language === "string"
          ? block.content.language
          : "javascript";

        return (
          <div className="block-content code-block-shell" onClick={handleClick}>
            <div className="code-toolbar">
              <div className="code-language-list">
                {CODE_LANGUAGES.map((language) => (
                  <button
                    key={language.id}
                    type="button"
                    className={`code-language-btn ${selectedLanguage === language.id ? "active" : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (!readOnly) {
                        onContentChange(block.id, { language: language.id });
                      }
                    }}
                    disabled={readOnly}
                  >
                    {language.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`code-copy-btn ${codeCopied ? "copied" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCopyCode}
                title="Copy code"
              >
                {codeCopied ? "Copied" : "Copy"}
              </button>
            </div>

            <pre
              ref={contentRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              className="block-content code code-editor"
              data-language={selectedLanguage}
              spellCheck="false"
              data-placeholder="Write code or paste snippet..."
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const position = getCursorPosition(contentRef.current);
                  const text = getBlockText(contentRef.current);
                  const newText = text.slice(0, position) + "  " + text.slice(position);
                  if (contentRef.current) {
                    contentRef.current.textContent = newText;
                  }
                  onContentChange(block.id, {
                    ...block.content,
                    text: newText,
                    html: contentRef.current?.innerHTML ?? newText,
                  });
                  setCursorPosition(contentRef.current, position + 2);
                  return;
                }

                if (e.key === "Enter") {
                  e.preventDefault();
                  const position = getCursorPosition(contentRef.current);
                  const text = getBlockText(contentRef.current);
                  const newText = `${text.slice(0, position)}\n${text.slice(position)}`;
                  if (contentRef.current) {
                    contentRef.current.textContent = newText;
                  }
                  onContentChange(block.id, {
                    ...block.content,
                    text: newText,
                    html: contentRef.current?.innerHTML ?? newText,
                  });
                  setCursorPosition(contentRef.current, position + 1);
                } else {
                  handleKeyDown(e as any);
                }
              }}
              onInput={handleInput}
              onBlur={handleBlur}
              onClick={handleClick}
            />
          </div>
        );
      }

      case "divider":
        return <hr className="block-content divider" />;

      case "image": {
        const rawImageUrl = ((block.content.url as string) ?? "").trim();
        const showInput = showImageUrlInput || !rawImageUrl || Boolean(imageLoadError);

        return (
          <div className="block-content image-block">
            {showInput && (
              <div className="image-link-input-wrap">
                <input
                  type="text"
                  placeholder="Paste image URL..."
                  value={rawImageUrl}
                  readOnly={readOnly}
                  onChange={(e) => {
                    if (readOnly) return;
                    const nextUrl = e.target.value.trim();
                    onContentChange(block.id, { url: nextUrl });
                    if (nextUrl.length === 0 || isValidImageUrl(nextUrl)) {
                      setImageLoadError(null);
                    } else {
                      setImageLoadError("Use a valid http/https image link.");
                    }
                  }}
                  onBlur={() => {
                    if (rawImageUrl && isValidImageUrl(rawImageUrl) && !imageLoadError) {
                      setShowImageUrlInput(false);
                    }
                  }}
                  onClick={handleClick}
                />
                {imageLoadError && <p className="image-link-error">{imageLoadError}</p>}
              </div>
            )}

            {rawImageUrl && (
              <div className="image-preview-wrap">
                <img
                  src={rawImageUrl}
                  alt="Block image"
                  className="block-image"
                  onLoad={() => {
                    setImageLoadError(null);
                    setShowImageUrlInput(false);
                  }}
                  onError={() => {
                    setImageLoadError("Image could not be loaded. Try another direct image URL.");
                    setShowImageUrlInput(true);
                  }}
                />

                {!showInput && (
                  <button
                    type="button"
                    className="image-link-edit-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowImageUrlInput(true)}
                    disabled={readOnly}
                  >
                    Change link
                  </button>
                )}
              </div>
            )}
          </div>
        );
      }

      case "todo":
        return (
          <div className="block-content todo" onClick={handleClick}>
            <input
              type="checkbox"
              checked={(block.content.checked as boolean) ?? false}
              disabled={readOnly}
              onChange={(e) => {
                if (readOnly) return;
                onContentChange(block.id, { checked: e.target.checked });
              }}
              className="todo-checkbox"
            />
            <div
              ref={contentRef}
              contentEditable={!readOnly}
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
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className="block-content paragraph"
            data-placeholder="Type '/' for commands"
            {...commonProps}
          />
        );
    }
  };

  return (
    <div
      className={`block ${block.type} ${isSelected ? "selected" : ""} ${isMultiSelected ? "multi-selected" : ""} ${isBeingDragged ? "being-dragged" : ""} ${dragOverPosition === "before" ? "drop-target-before" : ""} ${dragOverPosition === "after" ? "drop-target-after" : ""}`}
      data-block-id={block.id}
      onDragOver={(event) => onDragOver?.(block.id, event)}
      onDrop={(event) => onDrop?.(block.id, event)}
    >
      {!readOnly ? (
        <>
          <button
            type="button"
            className="block-drag-trigger block-drag-trigger-left"
            draggable
            onDragStart={handleBlockDragStart}
            onDragEnd={handleBlockDragEnd}
            onClick={() => onSelect(block.id)}
            aria-label="Drag block to reorder or delete"
            title="Drag block"
          >
            :::
          </button>

          <div className="block-hover-controls">
          <button
            type="button"
            className="block-add-trigger"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleAddBlock}
            aria-label="Add a block below"
            title="Add block"
          >
            +
          </button>
          </div>
        </>
      ) : null}

      <div className="block-main">{renderBlock()}</div>

      {!readOnly && toolbarState.visible && (
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
          <button type="button" onClick={() => wrapSelectionInTag("u", "underline")} title="Underline (Ctrl/Cmd+U)">
            U
          </button>
          <button
            type="button"
            onClick={() => wrapSelectionInTag("s", "strike")}
            title="Strikethrough (Ctrl/Cmd+Shift+X)"
          >
            S
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
